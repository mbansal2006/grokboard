import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from the project root
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

// Grok API configuration
const GROK_API_URL = 'https://api.x.ai/v1/chat/completions';
const GROK_API_KEY = process.env.GROK_API_KEY;

async function testGrokAPI() {
  try {
    if (!GROK_API_KEY) {
      throw new Error('GROK_API_KEY is not set in environment variables');
    }

    // Use minimal test content
    const testContent = `# Variables in JavaScript

Variables in JavaScript can be declared using \`let\`, \`const\`, or \`var\`. 

- \`let\` is used for variables that can be reassigned
- \`const\` is used for variables that cannot be reassigned`;

    const prompt = `You are an expert course creator. Based on the following markdown content, create a simple interactive course.

CRITICAL: You MUST return ONLY valid JSON. Do not include any markdown code blocks, explanations, or text before or after the JSON. Return ONLY the JSON object starting with { and ending with }.

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
    console.log('');

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

    console.log('📊 API Response metadata:');
    console.log(JSON.stringify(responseData, null, 2));
    console.log('');

    // Extract text content
    const rawContent = data.choices?.[0]?.message?.content || '';

    console.log('📝 Raw response length:', rawContent.length);
    console.log('📝 Raw response (first 500 chars):');
    console.log(rawContent.substring(0, 500));
    console.log('');
    console.log('📝 Raw response (last 500 chars):');
    console.log(rawContent.substring(Math.max(0, rawContent.length - 500)));
    console.log('');

    // Save raw response
    const rawPath = path.join(__dirname, 'test-raw-response.txt');
    await fs.writeFile(rawPath, rawContent, 'utf-8');
    console.log(`💾 Raw response saved to: ${rawPath}`);
    console.log('');

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
    console.log('');

    // Validate JSON structure
    let parsed = null;
    let parseError = null;
    try {
      parsed = JSON.parse(jsonContent);
      console.log('✅ JSON parsed successfully!');
      console.log('');
      console.log('📋 Parsed structure:');
      console.log({
        hasTitle: !!parsed.title,
        hasDescription: !!parsed.description,
        lessonsCount: parsed.lessons?.length || 0,
        firstLessonId: parsed.lessons?.[0]?.id,
        firstLessonTitle: parsed.lessons?.[0]?.title,
        firstLessonQuestions: parsed.lessons?.[0]?.questions?.length || 0,
      });
      console.log('');
      console.log('📄 Full parsed JSON (pretty printed):');
      console.log(JSON.stringify(parsed, null, 2));
    } catch (err) {
      parseError = {
        message: err.message,
        name: err.name,
      };
      console.error('❌ JSON parse failed:', err.message);
      console.error('');
      
      // Check brace balance
      const openBraces = (jsonContent.match(/{/g) || []).length;
      const closeBraces = (jsonContent.match(/}/g) || []).length;
      console.error(`Brace count - Open: ${openBraces}, Close: ${closeBraces}`);
      
      // Check if truncated
      if (data.choices?.[0]?.finish_reason === 'length') {
        console.error('');
        console.error('🔴 Response was truncated due to max_tokens!');
      }
      
      // Show error position if available
      const positionMatch = err.message.match(/position (\d+)/);
      if (positionMatch) {
        const errorPos = parseInt(positionMatch[1]);
        const start = Math.max(0, errorPos - 100);
        const end = Math.min(jsonContent.length, errorPos + 100);
        console.error('');
        console.error(`Error at position ${errorPos}:`);
        console.error(jsonContent.substring(start, end));
      }
    }

    // Save extracted JSON
    const jsonPath = path.join(__dirname, 'test-extracted-json.json');
    await fs.writeFile(jsonPath, jsonContent, 'utf-8');
    console.log('');
    console.log(`💾 Extracted JSON saved to: ${jsonPath}`);

    // Summary
    console.log('');
    console.log('═══════════════════════════════════════════════════════');
    if (parsed) {
      console.log('✅ TEST PASSED: JSON parsed successfully');
      console.log(`   Course: ${parsed.title}`);
      console.log(`   Lessons: ${parsed.lessons?.length || 0}`);
    } else {
      console.log('❌ TEST FAILED: Could not parse JSON');
      console.log(`   Error: ${parseError?.message}`);
    }
    console.log('═══════════════════════════════════════════════════════');

    process.exit(parsed ? 0 : 1);
  } catch (error) {
    console.error('❌ Test script error:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

testGrokAPI();
