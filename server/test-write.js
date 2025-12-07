import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testWrite() {
  try {
    console.log('🧪 TEST: Testing file writing functionality...');
    console.log('');

    // Test 1: Write a simple text file
    console.log('📝 Test 1: Writing text file...');
    const textContent = 'This is a test file written at ' + new Date().toISOString();
    const textPath = path.join(__dirname, 'test-write-output.txt');
    await fs.writeFile(textPath, textContent, 'utf-8');
    console.log(`✅ Text file written to: ${textPath}`);
    
    // Verify it was written correctly
    const readText = await fs.readFile(textPath, 'utf-8');
    if (readText === textContent) {
      console.log('✅ Text file read back correctly');
    } else {
      throw new Error('Text file content mismatch');
    }
    console.log('');

    // Test 2: Write a JSON file
    console.log('📝 Test 2: Writing JSON file...');
    const jsonData = {
      test: true,
      timestamp: new Date().toISOString(),
      data: {
        message: 'Hello, World!',
        numbers: [1, 2, 3, 4, 5]
      }
    };
    const jsonPath = path.join(__dirname, 'test-write-output.json');
    await fs.writeFile(jsonPath, JSON.stringify(jsonData, null, 2), 'utf-8');
    console.log(`✅ JSON file written to: ${jsonPath}`);
    
    // Verify it was written correctly
    const readJson = await fs.readFile(jsonPath, 'utf-8');
    const parsedJson = JSON.parse(readJson);
    if (parsedJson.test === jsonData.test && parsedJson.data.message === jsonData.data.message) {
      console.log('✅ JSON file read back correctly');
    } else {
      throw new Error('JSON file content mismatch');
    }
    console.log('');

    // Test 3: Create directory and write file
    console.log('📝 Test 3: Creating directory and writing file...');
    const testDir = path.join(__dirname, 'test-write-dir');
    await fs.mkdir(testDir, { recursive: true });
    console.log(`✅ Directory created: ${testDir}`);
    
    const dirFilePath = path.join(testDir, 'nested-file.txt');
    await fs.writeFile(dirFilePath, 'Nested file content', 'utf-8');
    console.log(`✅ File written in directory: ${dirFilePath}`);
    
    // Verify directory and file exist
    const dirStats = await fs.stat(testDir);
    if (dirStats.isDirectory()) {
      console.log('✅ Directory exists and is a directory');
    } else {
      throw new Error('Directory check failed');
    }
    
    const fileStats = await fs.stat(dirFilePath);
    if (fileStats.isFile()) {
      console.log('✅ File exists and is a file');
    } else {
      throw new Error('File check failed');
    }
    console.log('');

    // Test 4: Write large content
    console.log('📝 Test 4: Writing large content...');
    const largeContent = 'A'.repeat(10000) + '\n' + 'B'.repeat(10000);
    const largePath = path.join(__dirname, 'test-write-large.txt');
    await fs.writeFile(largePath, largeContent, 'utf-8');
    console.log(`✅ Large file written to: ${largePath}`);
    
    const largeStats = await fs.stat(largePath);
    console.log(`✅ Large file size: ${largeStats.size} bytes`);
    console.log('');

    // Test 5: Write with different encodings
    console.log('📝 Test 5: Writing with UTF-8 encoding...');
    const utf8Content = 'Hello, 世界! 🌍';
    const utf8Path = path.join(__dirname, 'test-write-utf8.txt');
    await fs.writeFile(utf8Path, utf8Content, 'utf-8');
    console.log(`✅ UTF-8 file written to: ${utf8Path}`);
    
    const readUtf8 = await fs.readFile(utf8Path, 'utf-8');
    if (readUtf8 === utf8Content) {
      console.log('✅ UTF-8 content read back correctly');
    } else {
      throw new Error('UTF-8 content mismatch');
    }
    console.log('');

    // Summary
    console.log('═══════════════════════════════════════════════════════');
    console.log('✅ ALL TESTS PASSED: File writing functionality works!');
    console.log('═══════════════════════════════════════════════════════');
    console.log('');
    console.log('📁 Test files created:');
    console.log(`   - ${textPath}`);
    console.log(`   - ${jsonPath}`);
    console.log(`   - ${dirFilePath}`);
    console.log(`   - ${largePath}`);
    console.log(`   - ${utf8Path}`);
    console.log('');
    console.log('💡 You can clean up test files by running:');
    console.log('   rm test-write-output.txt test-write-output.json test-write-large.txt test-write-utf8.txt');
    console.log('   rm -rf test-write-dir');

    process.exit(0);
  } catch (error) {
    console.error('❌ Test script error:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

testWrite();
