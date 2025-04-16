import ChatSession from '../models/ChatSession.js';

// @desc    Get all chat sessions for the logged-in user
// @route   GET /api/chats
// @access  Private
export const getChatSessions = async (req, res) => {
  try {
    const sessions = await ChatSession.find({ userId: req.user._id })
      .sort({ updatedAt: -1 }) // Sort by most recently updated
      .select('sessionId title createdAt updatedAt'); // Select only needed fields

    res.json(sessions);
  } catch (error) {
    console.error('Error fetching chat sessions:', error);
    res.status(500).json({ message: 'Server error fetching chat sessions' });
  }
};

// @desc    Get history for a specific chat session
// @route   GET /api/chats/:sessionId
// @access  Private
export const getChatHistory = async (req, res) => {
  try {
    const session = await ChatSession.findOne({
      sessionId: req.params.sessionId,
      userId: req.user._id,
    });

    if (!session) {
      return res.status(404).json({ message: 'Chat session not found' });
    }

    res.json(session.history); // Return only the history array
  } catch (error) {
    console.error('Error fetching chat history:', error);
    res.status(500).json({ message: 'Server error fetching chat history' });
  }
};

// @desc    Create a new chat session
// @route   POST /api/chats
// @access  Private
export const createChatSession = async (req, res) => {
  const { sessionId, title } = req.body; // Get sessionId and optional title from frontend

  if (!sessionId) {
    return res.status(400).json({ message: 'Session ID is required' });
  }

  try {
    // Check if session with this ID already exists for the user (should be rare)
    const existingSession = await ChatSession.findOne({ sessionId, userId: req.user._id });
    if (existingSession) {
      return res.status(409).json({ message: 'Session ID already exists' }); // Conflict
    }

    const newSession = new ChatSession({
      sessionId,
      userId: req.user._id,
      title: title || 'New Chat', // Use provided title or default
      history: [], // Start with empty history
    });

    const savedSession = await newSession.save();

    // Respond with the essential details of the created session
    res.status(201).json({
      sessionId: savedSession.sessionId,
      title: savedSession.title,
      createdAt: savedSession.createdAt,
      updatedAt: savedSession.updatedAt,
    });
  } catch (error) {
    console.error('Error creating chat session:', error);
    res.status(500).json({ message: 'Server error creating chat session' });
  }
};

// @desc    Add messages to a chat session's history
// @route   PUT /api/chats/:sessionId
// @access  Private
export const addMessagesToHistory = async (req, res) => {
  const { messages } = req.body; // Expecting an array of message objects { role: 'user'/'assistant', content: '...' }

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ message: 'Messages array is required' });
  }

  try {
    const session = await ChatSession.findOne({
      sessionId: req.params.sessionId,
      userId: req.user._id,
    });

    if (!session) {
      return res.status(404).json({ message: 'Chat session not found' });
    }

    // Add the new messages to the history
    session.history.push(...messages);
    session.updatedAt = Date.now(); // Explicitly update timestamp

    await session.save();

    res.status(200).json({ message: 'Messages added successfully' });
  } catch (error) {
    console.error('Error adding messages to history:', error);
    res.status(500).json({ message: 'Server error adding messages' });
  }
};

// @desc    Delete a specific chat session
// @route   DELETE /api/chats/:sessionId
// @access  Private
export const deleteChatSession = async (req, res) => {
  try {
    const deletedSession = await ChatSession.findOneAndDelete({
      sessionId: req.params.sessionId,
      userId: req.user._id, // Ensure the user owns this session
    });

    if (!deletedSession) {
      // If no session was found matching both sessionId and userId
      return res.status(404).json({ message: 'Chat session not found or user not authorized' });
    }

    res.status(200).json({ message: 'Chat session deleted successfully' });

  } catch (error) {
    console.error('Error deleting chat session:', error);
    res.status(500).json({ message: 'Server error deleting chat session' });
  }
};

// @desc    Update the title of a specific chat session
// @route   PUT /api/chats/:sessionId/title
// @access  Private
export const updateChatTitle = async (req, res) => {
  const { title } = req.body;

  if (!title || typeof title !== 'string' || title.trim() === '') {
    return res.status(400).json({ message: 'A valid title is required' });
  }

  try {
    const updatedSession = await ChatSession.findOneAndUpdate(
      { sessionId: req.params.sessionId, userId: req.user._id }, // Find condition
      { $set: { title: title.trim(), updatedAt: Date.now() } }, // Update operation
      { new: true, runValidators: true } // Options: return updated doc, run schema validators
    );

    if (!updatedSession) {
      return res.status(404).json({ message: 'Chat session not found or user not authorized' });
    }

    // Respond with minimal confirmation or the updated title/session details
    res.status(200).json({ 
      message: 'Chat title updated successfully', 
      title: updatedSession.title // Send back the updated title
    }); 

  } catch (error) {
    console.error('Error updating chat title:', error);
    res.status(500).json({ message: 'Server error updating chat title' });
  }
}; 