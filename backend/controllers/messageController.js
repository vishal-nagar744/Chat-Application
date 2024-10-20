import { Conversation } from "../models/conversationModel.js";
import { Message } from "../models/messageModel.js";
import { getReceiverSocketId, io } from "../socket/socket.js";
import { getFromCache, setInCache } from "../redis/redisUtils.js";  // Import the Redis utility functions

export const sendMessage = async (req, res) => {
    try {
        const senderId = req.id;
        const receiverId = req.params.id;
        const { message } = req.body;

        let gotConversation = await Conversation.findOne({
            participants: { $all: [senderId, receiverId] },
        });

        if (!gotConversation) {
            gotConversation = await Conversation.create({
                participants: [senderId, receiverId]
            });
        }

        const newMessage = await Message.create({
            senderId,
            receiverId,
            message
        });

        if (newMessage) {
            gotConversation.messages.push(newMessage._id);
        }

        await Promise.all([gotConversation.save(), newMessage.save()]);

        // Save the conversation and individual message in Redis
        const conversationKey = `conversation:${senderId}:${receiverId}`;
        const messageKey = `message:${newMessage._id}`;

        await setInCache(conversationKey, gotConversation);
        await setInCache(messageKey, newMessage);

        // SOCKET IO
        const receiverSocketId = getReceiverSocketId(receiverId);
        if (receiverSocketId) {
            io.to(receiverSocketId).emit("newMessage", newMessage);
        }

        return res.status(201).json({
            newMessage
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const getMessage = async (req, res) => {
    try {
        const receiverId = req.params.id;
        const senderId = req.id;

        const conversationKey = `conversation:${senderId}:${receiverId}`;

        // Try to get the conversation from Redis
        const cachedConversation = await getFromCache(conversationKey);

        if (cachedConversation) {
            console.log('Cache hit for conversation');
            const messagePromises = cachedConversation.messages.map(messageId => {
                const messageKey = `message:${messageId}`;
                return getFromCache(messageKey);
            });
            const cachedMessages = await Promise.all(messagePromises);
            if (cachedMessages.every(msg => msg !== null)) {
                console.log('Cache hit for all messages');
                return res.status(200).json(cachedMessages);
            }
        }

        console.log('Cache miss');
        const conversation = await Conversation.findOne({
            participants: { $all: [senderId, receiverId] }
        }).populate("messages");

        if (conversation) {
            // Store the conversation and individual messages in Redis
            await setInCache(conversationKey, conversation);
            const messagePromises = conversation.messages.map(async (message) => {
                const messageKey = `message:${message._id}`;
                await setInCache(messageKey, message);
                return message;
            });
            const messages = await Promise.all(messagePromises);
            return res.status(200).json(messages);
        }

        return res.status(404).json({ message: "Conversation not found" });
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
