// chatMemory.js
import { ChatMessageHistory } from "langchain/memory";
// import { RunnableWithMessageHistory } from "langchain/runnables";
import { RunnableWithMessageHistory } from "@langchain/core/runnables";
import { ChatOpenAI } from "@langchain/openai";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence, RunnablePassthrough } from "@langchain/core/runnables";
import { PromptTemplate } from "@langchain/core/prompts";
import { retriever } from "./retriever.js";
import { combineDocuments } from "./combineDocuments.js";


const openAIApiKey = process.env.OPENAI_API_KEY;
const llm = new ChatOpenAI({ openAIApiKey });

// Store for chat histories
const sessionHistories = new Map();

// Function to get or create chat history for a session
function getSessionHistory(sessionId) {
    if (!sessionHistories.has(sessionId)) {
        sessionHistories.set(sessionId, new ChatMessageHistory());
    }
    return sessionHistories.get(sessionId);
}

// Create the chain as before, but with some modifications to handle message history
const standaloneQuestionTemplate = `Given the following conversation history and a question, 
convert the question to a standalone question that captures the full context.
Chat History: {history}
Question: {question} 
Standalone question:`;

const standaloneQuestionPrompt = PromptTemplate.fromTemplate(standaloneQuestionTemplate);

const standaloneQuestionChain = standaloneQuestionPrompt.pipe(llm).pipe(new StringOutputParser());

const retrievalChain = RunnableSequence.from([
    prevResult => prevResult.standalone_question,
    retriever,
    combineDocuments
]);

const answerTemplate = `You are a helpful and enthusiastic support bot who can answer questions about Scrimba based on 
the context provided. Consider the chat history for context.
Previous conversation history: {history}
Context from documents: {context}
Question: {question}
Answer:`

const answerPrompt = PromptTemplate.fromTemplate(answerTemplate);

const answerChain = answerPrompt.pipe(llm).pipe(new StringOutputParser());

const chain = RunnableSequence.from([
    {
        standalone_question: standaloneQuestionChain,
        original_input: new RunnablePassthrough(),
        history: new RunnablePassthrough()
    },
    {
        context: retrievalChain,
        question: ({ original_input }) => original_input.question,
        history: ({ history }) => history
    },
    answerChain
]);

// Wrap the chain with message history
const chainWithHistory = new RunnableWithMessageHistory({
    runnable: chain,
    getMessageHistory: getSessionHistory,
    inputMessagesKey: "question",
    historyMessagesKey: "history",
});

// Main function to process conversations
export async function progressConversation(question, sessionId) {
    try {
        const response = await chainWithHistory.invoke(
            { question },
            { configurable: { sessionId } }
        );
        
        return response;
    } catch (error) {
        console.error('Error in conversation:', error);
        return "I'm sorry, I encountered an error. Please try again or contact support.";
    }
}