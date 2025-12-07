import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import archiver from 'archiver';
import { marked } from 'marked';
import dotenv from 'dotenv';
import { supabase } from './supabase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from the project root (parent directory)
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Grok API configuration
const GROK_API_URL = 'https://api.x.ai/v1/chat/completions';
const GROK_API_KEY = process.env.GROK_API_KEY;

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  },
});

const upload = multer({ storage });

// Ensure uploads directory exists
const ensureUploadsDir = async () => {
  const uploadsDir = path.join(__dirname, 'uploads');
  const coursesDir = path.join(__dirname, 'courses');
  const exportsDir = path.join(__dirname, 'exports');
  try {
    await fs.mkdir(uploadsDir, { recursive: true });
    await fs.mkdir(coursesDir, { recursive: true });
    await fs.mkdir(exportsDir, { recursive: true });
    console.log('Directories created/verified:', { uploadsDir, coursesDir, exportsDir });
  } catch (error) {
    console.error('Error creating directories:', error);
    throw error; // Fail fast if directories can't be created
  }
};

ensureUploadsDir().catch(err => {
  console.error('Failed to initialize directories:', err);
  process.exit(1);
});

// Helper function to check if Supabase is configured
function checkSupabase() {
  if (!supabase) {
    throw new Error('Supabase is not configured. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env file');
  }
}

// Read all markdown files from a directory
async function readMarkdownFiles(dirPath) {
  const files = await fs.readdir(dirPath);
  const markdownFiles = [];
  
  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const stat = await fs.stat(filePath);
    
    if (stat.isDirectory()) {
      const subFiles = await readMarkdownFiles(filePath);
      markdownFiles.push(...subFiles);
    } else if (file.endsWith('.md')) {
      const content = await fs.readFile(filePath, 'utf-8');
      markdownFiles.push({
        name: file,
        path: filePath,
        content: content,
      });
    }
  }
  
  return markdownFiles;
}

// Extract and parse JSON from Grok API response
function extractAndParseJSON(content, message) {
  let jsonContent = content.trim();
  
  // Try to extract from ```json code block (most common case)
  const jsonBlockMatch = jsonContent.match(/```json\s*\n([\s\S]*?)\n```/);
  if (jsonBlockMatch) {
    jsonContent = jsonBlockMatch[1].trim();
    console.log('Extracted JSON from markdown code block (```json)');
  } else {
    // Try plain code block
    const codeBlockMatch = jsonContent.match(/```\s*\n([\s\S]*?)\n```/);
    if (codeBlockMatch) {
      jsonContent = codeBlockMatch[1].trim();
      console.log('Extracted JSON from code block (```)');
    } else {
      // Try to find JSON object directly
      const firstBrace = jsonContent.indexOf('{');
      if (firstBrace !== -1) {
        let braceCount = 0;
        let jsonEnd = firstBrace;
        let inString = false;
        let escapeNext = false;
        
        for (let i = firstBrace; i < jsonContent.length; i++) {
          const char = jsonContent[i];
          
          // Handle string escaping
          if (escapeNext) {
            escapeNext = false;
            continue;
          }
          if (char === '\\') {
            escapeNext = true;
            continue;
          }
          if (char === '"') {
            inString = !inString;
            continue;
          }
          
          // Only count braces when not in a string
          if (!inString) {
            if (char === '{') braceCount++;
            if (char === '}') braceCount--;
            if (braceCount === 0) {
              jsonEnd = i + 1;
              break;
            }
          }
        }
        
        // Check if we found a complete JSON object
        if (braceCount === 0) {
          jsonContent = jsonContent.substring(firstBrace, jsonEnd);
          console.log('Extracted JSON object directly');
        } else {
          // JSON appears to be incomplete/truncated
          console.warn(`⚠️ WARNING: JSON appears incomplete. Brace count: ${braceCount}`);
          console.warn('This likely means the response was truncated');
          jsonContent = jsonContent.substring(firstBrace);
          console.log('Using partial JSON from first brace to end');
        }
      } else {
        console.warn('Could not find JSON in response, using full content');
      }
    }
  }
  
  // Clean up the JSON content
  jsonContent = jsonContent.trim();
  
  // Validate JSON structure before parsing
  if (!jsonContent.startsWith('{')) {
    console.warn('⚠️ WARNING: Extracted content does not start with {');
    const firstBrace = jsonContent.indexOf('{');
    if (firstBrace !== -1) {
      jsonContent = jsonContent.substring(firstBrace);
      console.log('Found { at position', firstBrace, '- using content from there');
    }
  }
  
  if (!jsonContent.endsWith('}')) {
    console.warn('⚠️ WARNING: Extracted content does not end with }');
    const lastBrace = jsonContent.lastIndexOf('}');
    if (lastBrace !== -1 && lastBrace > 0) {
      jsonContent = jsonContent.substring(0, lastBrace + 1);
      console.log('Found } at position', lastBrace, '- using content up to there');
    }
  }
  
  // Check if JSON looks incomplete
  const openBraces = (jsonContent.match(/{/g) || []).length;
  const closeBraces = (jsonContent.match(/}/g) || []).length;
  if (openBraces !== closeBraces) {
    console.warn(`⚠️ WARNING: JSON brace mismatch! Open: ${openBraces}, Close: ${closeBraces}`);
    console.warn('This indicates the JSON is likely incomplete/truncated');
  }
  
  // Final validation
  if (jsonContent.length === 0) {
    throw new Error('No JSON content extracted from API response');
  }
  
  return jsonContent;
}

// Generate course content using Grok
async function generateCourseContent(markdownFiles) {
  if (!GROK_API_KEY) {
    throw new Error('GROK_API_KEY is not set in environment variables');
  }

  const combinedContent = markdownFiles
    .map(file => `# ${file.name}\n\n${file.content}`)
    .join('\n\n---\n\n');

  // Log content size for debugging
  const contentSize = Buffer.byteLength(combinedContent, 'utf8');
  console.log(`Combined content size: ${contentSize} bytes (~${Math.round(contentSize / 4)} tokens estimated)`);
  
  if (contentSize > 1000000) { // ~1MB
    console.warn('Content is very large, may hit token limits');
  }

  const prompt = `You are an expert course creator. Based on the following markdown content, create an interactive course.

CRITICAL: You MUST return ONLY valid JSON. Do not include markdown code blocks, explanations, or any text before or after the JSON. Return ONLY the JSON object starting with { and ending with }.

Return a JSON object with this EXACT structure:
{
  "title": "Course Title",
  "description": "Course description",
  "lessons": [
    {
      "id": "lesson-1",
      "title": "Lesson Title",
      "content": "Lesson explanation in markdown format",
      "questions": [
        {
          "id": "q1",
          "type": "multiple-choice",
          "question": "Question text",
          "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
          "correctAnswer": 0,
          "explanation": "Explanation of the correct answer"
        }
      ],
      "codingExercises": [
        {
          "id": "code1",
          "title": "Exercise Title",
          "description": "Exercise description",
          "starterCode": "// Your code here",
          "language": "javascript",
          "testCases": [
            {
              "input": "example input",
              "expectedOutput": "expected output"
            }
          ],
          "solution": "// Solution code"
        }
      ]
    }
  ]
}

Requirements:
- Create multiple lessons covering all major topics from the markdown
- Each lesson should have at least 2-3 multiple choice questions
- Include coding exercises where appropriate
- Ensure all JSON is valid and properly formatted
- Return ONLY the JSON object, nothing else`;

  try {
    console.log('Calling Grok API...');
    const response = await fetch(GROK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'grok-4-1-fast-reasoning',
        max_tokens: 16000,
        messages: [
          {
            role: 'user',
            content: `${prompt}\n\nMarkdown Content:\n\n${combinedContent}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Grok API error (${response.status}): ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();

    // Log API response metadata
    console.log('API Response metadata:', {
      finish_reason: data.choices?.[0]?.finish_reason,
      model: data.model,
      usage: data.usage
    });

    // Check if response was truncated
    if (data.choices?.[0]?.finish_reason === 'length') {
      console.warn('⚠️ WARNING: Response was truncated due to max_tokens limit!');
      console.warn('Consider increasing max_tokens or reducing input size');
    }

    if (!data.choices || data.choices.length === 0 || !data.choices[0].message) {
      throw new Error('Empty response from Grok API');
    }

    // Extract text content from the response
    const content = data.choices[0].message.content;

    if (!content) {
      throw new Error('No text content found in Grok API response');
    }

    console.log('Received response from Grok API, length:', content.length);
    
    // Save raw response for debugging
    const rawResponsePath = path.join(__dirname, 'debug-raw-response.txt');
    await fs.writeFile(rawResponsePath, content, 'utf-8');
    console.log(`Raw response saved to: ${rawResponsePath}`);
    
    // Extract JSON from the response using shared function
    const jsonContent = extractAndParseJSON(content, data);
    
    // Log extracted JSON info for debugging
    console.log('Extracted JSON length:', jsonContent.length);
    console.log('First 100 chars:', jsonContent.substring(0, 100));
    console.log('Last 100 chars:', jsonContent.substring(Math.max(0, jsonContent.length - 100)));

    try {
      const parsed = JSON.parse(jsonContent);
      console.log('Successfully parsed JSON response');
      return parsed;
    } catch (parseError) {
      console.error('❌ Failed to parse JSON:', parseError.message);
      console.error('JSON content length:', jsonContent.length);
      console.error('JSON content (first 500 chars):', jsonContent.substring(0, 500));
      console.error('JSON content (last 500 chars):', jsonContent.substring(Math.max(0, jsonContent.length - 500)));
      
      // Check if error is due to incomplete JSON
      const isIncompleteError = parseError.message.includes('Unexpected end of JSON input') || 
                                parseError.message.includes('end of data');
      
      if (isIncompleteError) {
        console.error('🔍 DIAGNOSIS: JSON appears to be incomplete/truncated');
        console.error('Possible causes:');
        console.error('  1. Response hit max_tokens limit (currently 16000)');
        console.error('  2. API response was cut off mid-stream');
        console.error('  3. JSON extraction logic missed part of the response');
        console.error('');
        console.error('💡 SUGGESTIONS:');
        console.error('  - Check if stop_reason was "max_tokens" (see logs above)');
        console.error('  - Consider increasing max_tokens or reducing input size');
        console.error('  - Check the raw response file for the full content');
      }
      
      // Extract error position from error message if available
      const positionMatch = parseError.message.match(/position (\d+)/);
      if (positionMatch) {
        const errorPos = parseInt(positionMatch[1]);
        const start = Math.max(0, errorPos - 200);
        const end = Math.min(jsonContent.length, errorPos + 200);
        console.error(`JSON content around error position ${errorPos}:`, jsonContent.substring(start, end));
        console.error(`Character at error position:`, jsonContent[errorPos] || '(end of string)');
      }
      
      // Log the extracted JSON content to a file for debugging
      const debugPath = path.join(__dirname, 'debug-json-response.json');
      await fs.writeFile(debugPath, jsonContent, 'utf-8');
      console.error(`Extracted JSON content saved to: ${debugPath}`);
      
      // Also save a summary file
      const summaryPath = path.join(__dirname, 'debug-error-summary.json');
      await fs.writeFile(summaryPath, JSON.stringify({
        error: parseError.message,
        jsonLength: jsonContent.length,
        firstChars: jsonContent.substring(0, 200),
        lastChars: jsonContent.substring(Math.max(0, jsonContent.length - 200)),
        stopReason: message.stop_reason,
        usage: message.usage
      }, null, 2), 'utf-8');
      console.error(`Error summary saved to: ${summaryPath}`);
      
      throw new Error(`Failed to parse JSON response from Grok: ${parseError.message}. ${isIncompleteError ? 'Response appears to be truncated - check logs for details.' : ''}`);
    }
  } catch (error) {
    console.error('Error generating course:', error);
    // Handle Grok API errors properly
    if (error.status || error.statusCode) {
      const status = error.status || error.statusCode;
      const message = error.message || 'Unknown error';
      throw new Error(`Grok API error (${status}): ${message}`);
    }
    // Re-throw if it's already our custom error
    if (error.message && (error.message.includes('Grok API') || error.message.includes('Empty response') || error.message.includes('No text content'))) {
      throw error;
    }
    throw error;
  }
}

// Test endpoint to verify storage connectivity
app.get('/api/test-storage', async (req, res) => {
  try {
    checkSupabase();
    
    // Test Supabase connection by counting courses
    const { count, error } = await supabase
      .from('courses')
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      throw error;
    }
    
    res.json({
      success: true,
      message: 'Supabase storage is working correctly!',
      storage: {
        type: 'supabase',
        courseCount: count || 0
      }
    });
  } catch (error) {
    console.error('Storage test error:', error);
    res.status(500).json({
      error: 'Unexpected error testing storage',
      message: error.message,
      details: error.code === 'PGRST116' 
        ? 'Database table "courses" does not exist. Please run the migration SQL in supabase/migrations/001_create_courses_table.sql'
        : undefined
    });
  }
});

// Test endpoint to validate API response and parsing
app.post('/api/test-grok', async (req, res) => {
  try {
    if (!GROK_API_KEY) {
      return res.status(500).json({ error: 'GROK_API_KEY is not set' });
    }

    // Use minimal test content
    const testContent = `# Variables in JavaScript

Variables in JavaScript can be declared using \`let\`, \`const\`, or \`var\`. 

- \`let\` is used for variables that can be reassigned
- \`const\` is used for variables that cannot be reassigned`;

    const prompt = `You are an expert course creator. Based on the following markdown content, create a simple interactive course.

IMPORTANT: You MUST return ONLY valid JSON. Do not include any markdown code blocks, explanations, or text before or after the JSON. Return ONLY the JSON object.

Return a JSON object with this EXACT structure:
{
  "title": "Course Title",
  "description": "Course description",
  "lessons": [
    {
      "id": "lesson-1",
      "title": "Lesson Title",
      "content": "Lesson explanation in markdown format",
      "questions": [
        {
          "id": "q1",
          "type": "multiple-choice",
          "question": "Question text",
          "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
          "correctAnswer": 0,
          "explanation": "Explanation of the correct answer"
        }
      ],
      "codingExercises": []
    }
  ]
}

Markdown Content:
${testContent}`;

    console.log('🧪 TEST: Making small API call to Grok...');
    console.log('Test content length:', testContent.length);
    console.log('Prompt length:', prompt.length);

    const response = await fetch(GROK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'grok-4-1-fast-reasoning',
        max_tokens: 4000, // Small limit for testing
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Grok API error (${response.status}): ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();

    // Collect all response data
    const responseData = {
      finish_reason: data.choices?.[0]?.finish_reason,
      model: data.model,
      usage: data.usage,
    };

    console.log('📊 API Response metadata:', JSON.stringify(responseData, null, 2));

    // Extract text content
    const rawContent = data.choices?.[0]?.message?.content || '';

    console.log('📝 Raw response length:', rawContent.length);
    console.log('📝 Raw response (first 500 chars):', rawContent.substring(0, 500));
    console.log('📝 Raw response (last 500 chars):', rawContent.substring(Math.max(0, rawContent.length - 500)));

    // Save raw response
    const rawPath = path.join(__dirname, 'test-raw-response.txt');
    await fs.writeFile(rawPath, rawContent, 'utf-8');
    console.log(`💾 Raw response saved to: ${rawPath}`);

    // Try to extract JSON
    let jsonContent = rawContent.trim();
    
    // Remove markdown code blocks if present
    const jsonMatch = jsonContent.match(/```json\n([\s\S]*?)\n```/);
    if (jsonMatch) {
      jsonContent = jsonMatch[1];
      console.log('✅ Extracted JSON from markdown code block');
    } else {
      const jsonMatch2 = jsonContent.match(/```\n([\s\S]*?)\n```/);
      if (jsonMatch2) {
        jsonContent = jsonMatch2[1];
        console.log('✅ Extracted JSON from code block');
      } else {
        // Check if it starts with { and ends with }
        if (jsonContent.startsWith('{') && jsonContent.endsWith('}')) {
          console.log('✅ Content appears to be pure JSON');
        } else {
          // Try to find JSON object
          const firstBrace = jsonContent.indexOf('{');
          const lastBrace = jsonContent.lastIndexOf('}');
          if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            jsonContent = jsonContent.substring(firstBrace, lastBrace + 1);
            console.log('✅ Extracted JSON object from content');
          } else {
            console.warn('⚠️ Could not find JSON boundaries');
          }
        }
      }
    }

    jsonContent = jsonContent.trim();
    console.log('📦 Extracted JSON length:', jsonContent.length);

    // Validate JSON structure
    let parsed = null;
    let parseError = null;
    try {
      parsed = JSON.parse(jsonContent);
      console.log('✅ JSON parsed successfully!');
      console.log('📋 Parsed structure:', {
        hasTitle: !!parsed.title,
        hasDescription: !!parsed.description,
        lessonsCount: parsed.lessons?.length || 0,
        firstLessonId: parsed.lessons?.[0]?.id,
        firstLessonQuestions: parsed.lessons?.[0]?.questions?.length || 0,
      });
    } catch (err) {
      parseError = {
        message: err.message,
        name: err.name,
      };
      console.error('❌ JSON parse failed:', err.message);
      
      // Check brace balance
      const openBraces = (jsonContent.match(/{/g) || []).length;
      const closeBraces = (jsonContent.match(/}/g) || []).length;
      console.error(`Brace count - Open: ${openBraces}, Close: ${closeBraces}`);
      
      // Check if truncated
      if (data.choices?.[0]?.finish_reason === 'length') {
        console.error('🔴 Response was truncated due to max_tokens!');
      }
    }

    // Save extracted JSON
    const jsonPath = path.join(__dirname, 'test-extracted-json.json');
    await fs.writeFile(jsonPath, jsonContent, 'utf-8');
    console.log(`💾 Extracted JSON saved to: ${jsonPath}`);

    // Return comprehensive test results
    res.json({
      success: !!parsed,
      responseMetadata: responseData,
      rawContentLength: rawContent.length,
      extractedJsonLength: jsonContent.length,
      parseError: parseError,
      parsedData: parsed,
      diagnostics: {
        rawContentPreview: {
          first500: rawContent.substring(0, 500),
          last500: rawContent.substring(Math.max(0, rawContent.length - 500)),
        },
        extractedJsonPreview: {
          first500: jsonContent.substring(0, 500),
          last500: jsonContent.substring(Math.max(0, jsonContent.length - 500)),
        },
        files: {
          rawResponse: rawPath,
          extractedJson: jsonPath,
        },
      },
    });
  } catch (error) {
    console.error('❌ Test endpoint error:', error);
    res.status(500).json({
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});

// Upload markdown folder
app.post('/api/upload', upload.array('files'), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    console.log(`Received ${req.files.length} file(s) for upload`);
    const uploadDir = path.join(__dirname, 'uploads', req.body.folderId || 'default');
    await fs.mkdir(uploadDir, { recursive: true });

    // Move uploaded files to the folder
    for (const file of req.files) {
      const destPath = path.join(uploadDir, file.originalname);
      await fs.rename(file.path, destPath);
      console.log(`Moved file: ${file.originalname} to ${destPath}`);
    }

    // Read markdown files
    console.log(`Reading markdown files from: ${uploadDir}`);
    const markdownFiles = await readMarkdownFiles(uploadDir);
    
    if (markdownFiles.length === 0) {
      return res.status(400).json({ error: 'No markdown files found' });
    }

    console.log(`Found ${markdownFiles.length} markdown file(s)`);

    // Generate course content
    console.log('Generating course content with Grok...');
    const courseData = await generateCourseContent(markdownFiles);
    const courseId = `course-${Date.now()}`;
    
    courseData.id = courseId;
    courseData.createdAt = new Date().toISOString();
    
    // Save to Supabase
    checkSupabase();
    const { error } = await supabase
      .from('courses')
      .insert({
        id: courseId,
        title: courseData.title,
        description: courseData.description,
        created_at: courseData.createdAt,
        updated_at: courseData.createdAt,
        course_data: courseData
      });
    
    if (error) {
      throw error;
    }
    
    console.log(`Course created successfully: ${courseId}`);
    res.json({ courseId, course: courseData });
  } catch (error) {
    console.error('Error processing upload:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      error: error.message || 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Create course from folder path (for local development)
app.post('/api/create-course', async (req, res) => {
  try {
    const { folderPath } = req.body;
    
    if (!folderPath) {
      return res.status(400).json({ error: 'Folder path is required' });
    }

    const markdownFiles = await readMarkdownFiles(folderPath);
    
    if (markdownFiles.length === 0) {
      return res.status(400).json({ error: 'No markdown files found in folder' });
    }

    const courseData = await generateCourseContent(markdownFiles);
    const courseId = `course-${Date.now()}`;
    
    courseData.id = courseId;
    courseData.createdAt = new Date().toISOString();
    
    // Save to Supabase
    checkSupabase();
    const { error } = await supabase
      .from('courses')
      .insert({
        id: courseId,
        title: courseData.title,
        description: courseData.description,
        created_at: courseData.createdAt,
        updated_at: courseData.createdAt,
        course_data: courseData
      });
    
    if (error) {
      throw error;
    }
    
    res.json({ courseId, course: courseData });
  } catch (error) {
    console.error('Error creating course:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get course by ID
app.get('/api/course/:courseId', async (req, res) => {
  try {
    checkSupabase();
    const { courseId } = req.params;
    
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .eq('id', courseId)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Course not found' });
      }
      throw error;
    }
    
    if (!data) {
      return res.status(404).json({ error: 'Course not found' });
    }
    
    // Return the full course data from the JSONB field
    res.json(data.course_data);
  } catch (error) {
    console.error('Error fetching course:', error);
    res.status(500).json({ 
      error: 'Error fetching course',
      details: error.message
    });
  }
});

// Update course by ID
app.put('/api/course/:courseId', async (req, res) => {
  try {
    checkSupabase();
    const { courseId } = req.params;
    const { course } = req.body;
    
    if (!course) {
      return res.status(400).json({ error: 'Course data is required' });
    }
    
    // Validate course structure
    if (!course.title) {
      return res.status(400).json({ error: 'Course title is required' });
    }
    
    // Update the course in Supabase
    const { data, error } = await supabase
      .from('courses')
      .update({
        title: course.title,
        description: course.description || '',
        updated_at: new Date().toISOString(),
        course_data: course
      })
      .eq('id', courseId)
      .select()
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Course not found' });
      }
      throw error;
    }
    
    if (!data) {
      return res.status(404).json({ error: 'Course not found' });
    }
    
    res.json({ success: true, course: data.course_data });
  } catch (error) {
    console.error('Error updating course:', error);
    res.status(500).json({ 
      error: 'Error updating course',
      details: error.message
    });
  }
});

// List all courses
app.get('/api/courses', async (req, res) => {
  try {
    checkSupabase();
    
    // Filter out courses created before December 6, 2024
    const cutoffDate = '2024-12-06T00:00:00.000Z';
    
    const { data, error } = await supabase
      .from('courses')
      .select('id, title, description, created_at, course_data')
      .gte('created_at', cutoffDate)
      .order('created_at', { ascending: false });
    
    if (error) {
      throw error;
    }
    
    const courseList = (data || []).map(row => ({
      id: row.id,
      title: row.title,
      description: row.description,
      createdAt: row.created_at,
      lessonCount: row.course_data?.lessons?.length || 0,
    }));
    
    res.json(courseList);
  } catch (error) {
    console.error('Error fetching courses:', error);
    res.status(500).json({ 
      error: 'Error fetching courses',
      details: error.message,
      code: error.code === 'PGRST116' 
        ? 'Database table "courses" does not exist. Please run the migration SQL.'
        : error.code
    });
  }
});

// Export course as standalone application
app.get('/api/export/:courseId', async (req, res) => {
  try {
    checkSupabase();
    const { courseId } = req.params;
    
    const { data, error } = await supabase
      .from('courses')
      .select('course_data')
      .eq('id', courseId)
      .single();
    
    if (error || !data) {
      return res.status(404).json({ error: 'Course not found' });
    }
    
    const course = data.course_data;

    // Create export package
    const exportDir = path.join(__dirname, 'exports', courseId);
    await fs.mkdir(exportDir, { recursive: true });

    // Create standalone HTML file with embedded CSS and JavaScript
    const standaloneHTML = await generateStandaloneApp(course);
    
    await fs.writeFile(
      path.join(exportDir, 'index.html'),
      standaloneHTML
    );

    // Create a zip file
    const zipPath = path.join(__dirname, 'exports', `${courseId}.zip`);
    const output = createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    return new Promise((resolve, reject) => {
      archive.pipe(output);
      archive.directory(exportDir, false);
      archive.finalize();

      output.on('close', () => {
        res.download(zipPath, `${course.title.replace(/\s+/g, '-')}.zip`, (err) => {
          if (err) {
            console.error('Error downloading file:', err);
            reject(err);
          } else {
            // Clean up
            fs.unlink(zipPath).catch(console.error);
            resolve();
          }
        });
      });

      archive.on('error', reject);
    });
  } catch (error) {
    console.error('Error exporting course:', error);
    res.status(500).json({ error: error.message });
  }
});

// Generate standalone HTML application
async function generateStandaloneApp(course) {
  // Escape HTML to prevent XSS (Node.js version)
  const escapeHtml = (text) => {
    if (text == null) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  // Generate HTML content for lessons
  const generateLessonsHTML = (lessons) => {
    if (!lessons || lessons.length === 0) return '';
    
    return lessons.map((lesson, lessonIdx) => {
      // Create safe ID for lesson
      const lessonId = (lesson.id || `lesson-${lessonIdx}`).replace(/[^a-zA-Z0-9-_]/g, '-');
      const safeLessonId = escapeHtml(lessonId);
      let html = `
        <div class="lesson-card" data-lesson-id="${safeLessonId}">
          <h2>${escapeHtml(lesson.title || 'Untitled Lesson')}</h2>
          <div class="lesson-content" id="content-${safeLessonId}"></div>`;

      // Questions section
      if (lesson.questions && lesson.questions.length > 0) {
        html += `
          <div class="questions-section">
            <h3>Questions</h3>`;
        
        lesson.questions.forEach((q, qIdx) => {
          const questionId = (q.id || `q-${lessonIdx}-${qIdx}`).replace(/[^a-zA-Z0-9-_]/g, '-');
          const safeQuestionId = escapeHtml(questionId);
          html += `
            <div class="question" data-question-id="${safeQuestionId}">
              <h4>${escapeHtml(q.question || '')}</h4>
              <div class="options">`;
          
          (q.options || []).forEach((option, idx) => {
            html += `
                <div class="option" 
                     data-question-id="${safeQuestionId}" 
                     data-option-index="${idx}"
                     onclick="handleAnswerSelect('${safeQuestionId}', ${idx})">
                  ${escapeHtml(option)}
                </div>`;
          });
          
          html += `
              </div>
              <button class="check-btn" 
                      id="check-btn-${safeQuestionId}" 
                      onclick="checkAnswer('${safeQuestionId}', ${q.correctAnswer || 0})"
                      style="display: none;">
                Check Answer
              </button>
              <div class="explanation" id="explanation-${safeQuestionId}" style="display: none;">
                <strong>Explanation:</strong> ${escapeHtml(q.explanation || '')}
              </div>
            </div>`;
        });
        
        html += `
          </div>`;
      }

      // Coding exercises section
      if (lesson.codingExercises && lesson.codingExercises.length > 0) {
        html += `
          <div class="coding-section">
            <h3>Coding Exercises</h3>`;
        
        lesson.codingExercises.forEach((ex, exIdx) => {
          const exerciseId = (ex.id || `ex-${lessonIdx}-${exIdx}`).replace(/[^a-zA-Z0-9-_]/g, '-');
          const safeExerciseId = escapeHtml(exerciseId);
          html += `
            <div class="coding-exercise" data-exercise-id="${safeExerciseId}">
              <h4>${escapeHtml(ex.title || '')}</h4>
              <p>${escapeHtml(ex.description || '')}</p>`;
          
          if (ex.testCases && ex.testCases.length > 0) {
            html += `
              <div class="test-cases">
                <strong>Test Cases:</strong>
                <ul>`;
            ex.testCases.forEach(testCase => {
              html += `
                  <li>
                    Input: <code>${escapeHtml(testCase.input || '')}</code> → 
                    Expected: <code>${escapeHtml(testCase.expectedOutput || '')}</code>
                  </li>`;
            });
            html += `
                </ul>
              </div>`;
          }
          
          html += `
              <div class="editor-container">
                <textarea id="code-editor-${safeExerciseId}" 
                          class="code-textarea"
                          spellcheck="false">${escapeHtml(ex.starterCode || '')}</textarea>
              </div>
              <button class="solution-btn" 
                      onclick="toggleCodeSolution('${safeExerciseId}')">
                Show Solution
              </button>
              <div class="solution" id="solution-${safeExerciseId}" style="display: none;">
                <strong>Solution:</strong>
                <pre><code>${escapeHtml(ex.solution || '')}</code></pre>
              </div>
            </div>`;
        });
        
        html += `
          </div>`;
      }

      html += `
        </div>`;
      return html;
    }).join('');
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${course.title || 'Course'}</title>
    <script src="https://cdn.jsdelivr.net/npm/marked@11.1.1/marked.min.js"></script>
    <style>
        /* Reset and base styles */
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
                'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
                sans-serif;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            background: #f5f5f5;
            color: #333;
        }

        code {
            font-family: 'Courier New', monospace;
        }

        /* Course viewer styles */
        .course-viewer {
            max-width: 1000px;
            margin: 0 auto;
            padding: 40px 20px;
        }

        .course-header {
            background: white;
            padding: 32px;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            margin-bottom: 24px;
        }

        .course-header h1 {
            font-size: 32px;
            margin-bottom: 12px;
            color: #333;
        }

        .course-description {
            color: #666;
            font-size: 16px;
            line-height: 1.6;
        }

        .lessons {
            display: flex;
            flex-direction: column;
            gap: 24px;
        }

        .lesson-card {
            background: white;
            padding: 32px;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .lesson-card h2 {
            font-size: 24px;
            margin-bottom: 16px;
            color: #333;
            border-bottom: 2px solid #2196F3;
            padding-bottom: 8px;
        }

        .lesson-content {
            line-height: 1.8;
            color: #444;
            margin-bottom: 32px;
        }

        .lesson-content h1,
        .lesson-content h2,
        .lesson-content h3 {
            margin-top: 24px;
            margin-bottom: 12px;
            color: #333;
        }

        .lesson-content code {
            background: #f5f5f5;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: 'Courier New', monospace;
            font-size: 0.9em;
        }

        .lesson-content pre {
            background: #f5f5f5;
            padding: 16px;
            border-radius: 6px;
            overflow-x: auto;
            margin: 16px 0;
        }

        .lesson-content pre code {
            background: none;
            padding: 0;
        }

        .questions-section,
        .coding-section {
            margin-top: 32px;
            padding-top: 32px;
            border-top: 1px solid #eee;
        }

        .questions-section h3,
        .coding-section h3 {
            font-size: 20px;
            margin-bottom: 20px;
            color: #333;
        }

        .question {
            margin-bottom: 32px;
            padding: 20px;
            background: #f9f9f9;
            border-radius: 8px;
        }

        .question h4 {
            font-size: 16px;
            margin-bottom: 16px;
            color: #333;
        }

        .options {
            display: flex;
            flex-direction: column;
            gap: 12px;
            margin-bottom: 16px;
        }

        .option {
            padding: 14px 16px;
            background: white;
            border: 2px solid #e0e0e0;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.2s;
            font-size: 14px;
        }

        .option:hover {
            border-color: #2196F3;
            background: #f5f5f5;
        }

        .option.selected {
            border-color: #2196F3;
            background: #e3f2fd;
        }

        .option.correct {
            border-color: #4CAF50;
            background: #e8f5e9;
        }

        .option.incorrect {
            border-color: #f44336;
            background: #ffebee;
        }

        .check-btn {
            padding: 10px 20px;
            background: #2196F3;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            margin-top: 8px;
        }

        .check-btn:hover {
            background: #1976D2;
        }

        .explanation {
            margin-top: 16px;
            padding: 16px;
            background: #e3f2fd;
            border-radius: 6px;
            border-left: 4px solid #2196F3;
        }

        .explanation strong {
            color: #1976D2;
        }

        .coding-exercise {
            margin-bottom: 32px;
            padding: 20px;
            background: #f9f9f9;
            border-radius: 8px;
        }

        .coding-exercise h4 {
            font-size: 18px;
            margin-bottom: 12px;
            color: #333;
        }

        .coding-exercise p {
            color: #666;
            margin-bottom: 16px;
            line-height: 1.6;
        }

        .test-cases {
            margin-bottom: 16px;
            padding: 12px;
            background: white;
            border-radius: 6px;
        }

        .test-cases strong {
            display: block;
            margin-bottom: 8px;
            color: #333;
        }

        .test-cases ul {
            list-style: none;
            margin-left: 0;
        }

        .test-cases li {
            padding: 6px 0;
            color: #666;
            font-size: 14px;
        }

        .test-cases code {
            background: #f5f5f5;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: 'Courier New', monospace;
        }

        .editor-container {
            margin: 16px 0;
            border: 1px solid #ddd;
            border-radius: 6px;
            overflow: hidden;
        }

        .code-textarea {
            width: 100%;
            height: 400px;
            font-family: 'Courier New', monospace;
            font-size: 14px;
            padding: 12px;
            border: none;
            background: #1e1e1e;
            color: #d4d4d4;
            resize: none;
            outline: none;
            tab-size: 2;
        }

        .solution-btn {
            padding: 10px 20px;
            background: #4CAF50;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            margin-top: 12px;
        }

        .solution-btn:hover {
            background: #45a049;
        }

        .solution {
            margin-top: 16px;
            padding: 16px;
            background: white;
            border-radius: 6px;
            border-left: 4px solid #4CAF50;
        }

        .solution strong {
            display: block;
            margin-bottom: 8px;
            color: #333;
        }

        .solution pre {
            background: #f5f5f5;
            padding: 12px;
            border-radius: 4px;
            overflow-x: auto;
            margin-top: 8px;
        }

        .solution code {
            font-family: 'Courier New', monospace;
            font-size: 14px;
        }
    </style>
</head>
<body>
    <div class="course-viewer">
        <div class="course-header">
            <h1>${escapeHtml(course.title || 'Course')}</h1>
            <p class="course-description">${escapeHtml(course.description || '')}</p>
        </div>

        <div class="lessons">
            ${generateLessonsHTML(course.lessons || [])}
        </div>
    </div>

    <script>
        // Course data
        const courseData = ${JSON.stringify(course, null, 2)};

        // State management
        const state = {
            selectedAnswers: {},
            showExplanations: {},
            codeSolutions: {}
        };

        // Escape HTML helper
        function escapeHtml(text) {
            if (text == null) return '';
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        // Sanitize ID helper (same logic as server-side)
        function sanitizeId(id) {
            return String(id || '').replace(/[^a-zA-Z0-9-_]/g, '-');
        }

        // Initialize markdown content
        function initializeMarkdown() {
            courseData.lessons.forEach((lesson, lessonIdx) => {
                const lessonId = sanitizeId(lesson.id || \`lesson-\${lessonIdx}\`);
                const contentElement = document.getElementById('content-' + lessonId);
                if (contentElement && lesson.content) {
                    if (typeof marked !== 'undefined' && marked.parse) {
                        contentElement.innerHTML = marked.parse(lesson.content);
                    } else {
                        // Fallback if marked.js fails to load
                        contentElement.textContent = lesson.content;
                    }
                }
            });
        }

        // Handle answer selection
        function handleAnswerSelect(questionId, answerIndex) {
            state.selectedAnswers[questionId] = answerIndex;
            
            // Update UI
            const questionElement = document.querySelector('[data-question-id="' + questionId + '"]');
            if (!questionElement) return;
            
            // Remove selected class from all options
            questionElement.querySelectorAll('.option').forEach(opt => {
                opt.classList.remove('selected');
            });
            
            // Add selected class to chosen option
            const selectedOption = questionElement.querySelector('[data-option-index="' + answerIndex + '"]');
            if (selectedOption) {
                selectedOption.classList.add('selected');
            }
            
            // Show check button
            const checkBtn = document.getElementById('check-btn-' + questionId);
            if (checkBtn) {
                checkBtn.style.display = 'block';
            }
        }

        // Check answer
        function checkAnswer(questionId, correctAnswer) {
            state.showExplanations[questionId] = true;
            
            const questionElement = document.querySelector('[data-question-id="' + questionId + '"]');
            if (!questionElement) return;
            
            // Mark correct/incorrect answers
            questionElement.querySelectorAll('.option').forEach((opt, idx) => {
                opt.classList.remove('correct', 'incorrect');
                if (idx === correctAnswer) {
                    opt.classList.add('correct');
                } else if (state.selectedAnswers[questionId] === idx) {
                    opt.classList.add('incorrect');
                }
            });
            
            // Show explanation
            const explanation = document.getElementById('explanation-' + questionId);
            if (explanation) {
                explanation.style.display = 'block';
            }
        }

        // Toggle code solution
        function toggleCodeSolution(exerciseId) {
            state.codeSolutions[exerciseId] = !state.codeSolutions[exerciseId];
            
            const solution = document.getElementById('solution-' + exerciseId);
            const button = event.target;
            
            if (solution) {
                solution.style.display = state.codeSolutions[exerciseId] ? 'block' : 'none';
            }
            
            if (button) {
                button.textContent = state.codeSolutions[exerciseId] ? 'Hide Solution' : 'Show Solution';
            }
        }

        // Initialize when DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initializeMarkdown);
        } else {
            initializeMarkdown();
        }
    </script>
</body>
</html>`;
}

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
