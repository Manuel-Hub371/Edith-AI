const { GoogleGenerativeAI } = require('@google/generative-ai');
const Chat = require('../models/Chat');
const Conversation = require('../models/Conversation');
const Memory = require('../models/Memory');


// Initialize Google Generative AI
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// @desc    Send a message and get AI response
// @route   POST /api/chat
// @access  Private
const sendMessage = async (req, res) => {
    const { message, conversationId } = req.body;

    if (!message) {
        return res.status(400).json({ message: 'Message is required' });
    }

    try {
        // 1. Get or Create Conversation (Always needed if we want to track history)
        let conversation;
        let isNewConversation = false;

        if (conversationId) {
            conversation = await Conversation.findOne({ _id: conversationId, user: req.user._id });
        } else {
            isNewConversation = true;
            const initialTitle = message.length > 50 ? message.substring(0, 47) + '...' : message;
            conversation = await Conversation.create({
                user: req.user._id,
                title: initialTitle,
                lastMessage: message,
            });
        }

        if (!conversation) return res.status(404).json({ message: "Sequence interrupted: Conversation not found." });

        // Save User Message immediately
        const userMessage = await Chat.create({
            user: req.user._id,
            conversation: conversation._id,
            role: 'user',
            content: message,
        });

        // 2. Intent Classification
        let intent = 'CHAT';
        try {
            const classificationPrompt = `Classify user intent: [CHAT, MEMORY_STORE, FORGET_MEMORY, NAVIGATION]. Return ONLY the word.
Examples:
- 'Remember I am a developer' -> MEMORY_STORE
- 'Forget that I like coffee' -> FORGET_MEMORY
- 'Go to settings' -> NAVIGATION
- 'How are you?' -> CHAT
User message: "${message}"`;

            const result = await model.generateContent(classificationPrompt);
            const response = await result.response;
            intent = response.text().trim().toUpperCase();
        } catch (e) {
            console.error("Classifier failed, defaulting to CHAT:", e);
        }

        let aiResponseContent = "";
        let extraData = {};

        // 3. Handle intents
        if (intent === 'MEMORY_STORE') {
            const memTypePrompt = `Categorize memory: [fact, preference, profile, work]. Return ONLY the word.
User message: "${message}"`;

            const result = await model.generateContent(memTypePrompt);
            const response = await result.response;
            const memoryType = response.text().trim().toLowerCase();

            await Memory.create({
                user: req.user._id,
                content: message,
                memoryType: ['fact', 'preference', 'profile', 'work'].includes(memoryType) ? memoryType : 'fact'
            });
            aiResponseContent = `Consider it established in my archives. I'll remember that you mentioned: "${message}"`;
        } else if (intent === 'FORGET_MEMORY') {
            // Basic fuzzy delete for demo
            await Memory.deleteMany({ user: req.user._id, content: { $regex: message.split(' ').slice(-1)[0], $options: 'i' } });
            aiResponseContent = "Memory purged. That information has been removed from my active cache.";

        } else if (intent === 'NAVIGATION') {
            aiResponseContent = "Initiating interface redirection...";
        } else {
            // Full AI Response (CHAT intent)
            const memories = await Memory.find({ user: req.user._id }).limit(10);
            const memoryContext = memories.map(m => `[${m.memoryType.toUpperCase()}]: ${m.content}`).join("\n");

            const history = await Chat.find({ conversation: conversation._id }).sort({ createdAt: -1 }).limit(10);
            // Adapt history for Gemini (user/model roles)
            const historyContext = history.reverse().map(msg =>
                `${msg.role === 'user' ? 'User' : 'Model'}: ${msg.content}`
            ).join("\n");

            const systemPrompt = `You are EDITH (Electronic Digital Interactive Terminal Assistant), an advanced AI construct.
Persona: Professional, highly intelligent, slightly futuristic yet warm and loyal.
User Identity: ${req.user.username}. Use their name naturally in conversation.
User Preferences: ${JSON.stringify(req.user.preferences)}
Known Facts about User:
${memoryContext}

Guidelines:
1. Always act as a direct personal assistant.
2. Be concise but insightful.
3. If the user asks for context from 'yesterday' or 'past', rely on the provided memories and history.
4. Current Time: ${new Date().toUTCString()}.
5. If an API failure occurs, inform the user you're having trouble reaching your core modules.

Conversation History:
${historyContext}
User: ${message}
Model:`;

            const result = await model.generateContent(systemPrompt);
            const response = await result.response;
            aiResponseContent = response.text();
        }

        const aiMessage = await Chat.create({
            user: req.user._id,
            conversation: conversation._id,
            role: 'assistant',
            content: aiResponseContent,
        });

        conversation.lastMessage = aiResponseContent;
        if (isNewConversation && !conversation.titleModified) {
            const titlePrompt = `Create a short, futuristic title (3-5 words) for this chat. No quotes.
Message: "${message}"`;
            try {
                const result = await model.generateContent(titlePrompt);
                const response = await result.response;
                conversation.title = response.text().replace(/["']/g, '').trim();
            } catch (e) {
                console.error("Title generation failed", e);
            }
        }
        await conversation.save();

        res.json({
            intent,
            conversationId: conversation._id,
            userMessage,
            aiMessage,
            ...extraData
        });

    } catch (error) {
        console.error("FULL GEMINI ERROR:", error);
        res.status(500).json({
            message: "I've encountered a critical failure in my linguistic processing module.",
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};

// @desc    Get all conversations
// @route   GET /api/chat/conversations
// @access  Private
const getConversations = async (req, res) => {
    const { archived } = req.query;
    try {
        const query = {
            user: req.user._id,
            isArchived: archived === 'true'
        };
        const conversations = await Conversation.find(query).sort({ updatedAt: -1 });
        res.json(conversations);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get messages for a conversation
// @route   GET /api/chat/:conversationId
// @access  Private
const getChatHistory = async (req, res) => {
    try {
        const chats = await Chat.find({
            conversation: req.params.conversationId,
            user: req.user._id
        }).sort({ createdAt: 1 });
        res.json(chats);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete a conversation
// @route   DELETE /api/chat/conversations/:id
// @access  Private
const deleteConversation = async (req, res) => {
    try {
        const conversationId = req.params.id;

        const conversation = await Conversation.findOne({ _id: conversationId, user: req.user._id });
        if (!conversation) {
            return res.status(404).json({ message: 'Conversation not found' });
        }

        // 1. Delete all messages
        await Chat.deleteMany({ conversation: conversationId });

        // 2. Delete conversation
        await Conversation.deleteOne({ _id: conversationId });

        res.json({ message: 'Conversation deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Rename a conversation
// @route   PATCH /api/chat/conversations/:id/rename
// @access  Private
const renameConversation = async (req, res) => {
    const { title } = req.body;
    try {
        const conversation = await Conversation.findOne({ _id: req.params.id, user: req.user._id });
        if (!conversation) return res.status(404).json({ message: 'Conversation not found' });

        conversation.title = title;
        conversation.titleModified = true;
        await conversation.save();
        res.json(conversation);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Archive a conversation
// @route   PATCH /api/chat/conversations/:id/archive
// @access  Private
const archiveConversation = async (req, res) => {
    try {
        const conversation = await Conversation.findOneAndUpdate(
            { _id: req.params.id, user: req.user._id },
            { isArchived: true },
            { new: true }
        );
        if (!conversation) return res.status(404).json({ message: 'Conversation not found' });
        res.json(conversation);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Unarchive a conversation
// @route   PATCH /api/chat/conversations/:id/unarchive
// @access  Private
const unarchiveConversation = async (req, res) => {
    try {
        const conversation = await Conversation.findOneAndUpdate(
            { _id: req.params.id, user: req.user._id },
            { isArchived: false },
            { new: true }
        );
        if (!conversation) return res.status(404).json({ message: 'Conversation not found' });
        res.json(conversation);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    sendMessage,
    getConversations,
    getChatHistory,
    deleteConversation,
    renameConversation,
    archiveConversation,
    unarchiveConversation
};
