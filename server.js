require("dotenv").config();
const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");

const app = express();
app.use(cors());
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // Read API key from .env file
});

// YOUR ASSISTANT ID HERE
const ASSISTANT_ID = "asst_ODSECIUwulFKZust3AB9QHkk"; // Replace with your actual Assistant ID

// Route for text-based conversation
// Store threads for each user session (temporary storage)
const userThreads = {};

app.post("/chat", async (req, res) => {
  try {
    const userId = req.body.userId || "default"; // Unique user ID (session-based)
    const userMessage = req.body.message;

    // Log incoming request
    console.log(`Received message from user: ${userMessage}`);

 // Get the thread ID from the request, or create a new one
let threadId = req.body.threadId;

if (!threadId) {
    const thread = await openai.beta.threads.create();
    threadId = thread.id;
    console.log("Created new thread ID:", threadId);
}

// Send the thread ID back to the frontend so it stays in sessionStorage
res.json({ threadId });
    console.log("📌 Using thread ID:", threadId); // Debugging

    // Send the user's message to the assistant
    await openai.beta.threads.messages.create(threadId, {
      role: "user",
      content: userMessage,
    });

    // Run the assistant within the thread
    const run = await openai.beta.threads.runs.create(threadId, {
      assistant_id: ASSISTANT_ID,
    });

    console.log("🚀 Started assistant run, run ID:", run.id);

    // Wait for the assistant's response
    let runStatus;
    do {
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 sec
runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
      console.log("⏳ Run status:", runStatus.status);
    } while (runStatus.status !== "completed");

    // Retrieve the latest assistant response
const messages = await openai.beta.threads.messages.list(threadId);

	  console.log("📜 All Messages in Thread:", messages.data.map(m => ({ role: m.role, content: m.content[0].text.value })));
	  
// Ensure messages are sorted from oldest to newest
const sortedMessages = messages.data.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

// Find the latest assistant message
const lastAssistantMessage = sortedMessages.reverse().find(msg => msg.role === "assistant");

const assistantReply = lastAssistantMessage ? lastAssistantMessage.content[0].text.value : "No response from assistant.";

    console.log("💬 Assistant reply:", assistantReply);

    res.json({ reply: assistantReply });
  } catch (error) {
    console.error("❌ Error in /chat route:", error);
    res.status(500).json({ error: "Something went wrong with the assistant." });
  }
});

// Route for voice-to-text (Speech Recognition)
app.post("/speech-to-text", async (req, res) => {
  try {
    const audioFile = req.files.audio; // Expecting a file upload

    // Convert audio to text
const transcription = await openai.audio.transcriptions.create({
  file: audioFile,
  model: "whisper-1",
  language: "de" 
});

    res.json({ text: transcription.text });
  } catch (error) {
    console.error("Speech-to-text error:", error);
    res.status(500).json({ error: "Speech recognition failed." });
  }
});

// Route for text-to-speech
app.post("/text-to-speech", async (req, res) => {
  try {
    const { text } = req.body;

    // Validate input
    if (!text) {
      return res.status(400).json({ error: "Missing text input for TTS" });
    }

    // Convert text to speech
    const response = await openai.audio.speech.create({
      model: "tts-1",
      voice: "alloy", // You can change voices: alloy, echo, fable, onyx, nova, shimmer
      input: text,
      response_format: "mp3"
    });

    console.log("🔊 TTS API response received for text:", text);

    // ✅ Fix: Correctly handle the response stream
res.setHeader("Content-Type", "audio/mpeg");
res.setHeader("Transfer-Encoding", "chunked"); // Allows real-time streaming
response.body.pipe(res); // Stream audio directly
  } catch (error) {
    console.error("❌ Text-to-speech error:", error);
    res.status(500).json({ error: "TTS conversion failed." });
  }
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));