// @desc    Convert Speech to Text (STT)
// @route   POST /api/voice/stt
// @access  Private
const speechToText = async (req, res) => {
    return res.status(503).json({ message: "Voice features are currently unavailable (Migration to Gemini in progress)." });
};

// @desc    Convert Text to Speech (TTS)
// @route   POST /api/voice/tts
// @access  Private
const textToSpeech = async (req, res) => {
    return res.status(503).json({ message: "Voice features are currently unavailable (Migration to Gemini in progress)." });
};

module.exports = { speechToText, textToSpeech };
