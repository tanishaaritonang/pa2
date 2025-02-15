import { ChatMessageHistory } from "langchain/memory";
import { RunnableWithMessageHistory } from "@langchain/core/runnables";
import { ChatOpenAI } from "@langchain/openai";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence, RunnablePassthrough } from "@langchain/core/runnables";
import { PromptTemplate } from "@langchain/core/prompts";
import { retriever } from "./retriever.js";
import { combineDocuments } from "./combineDocuments.js";
import { HumanMessage, AIMessage } from "@langchain/core/messages";

const openAIApiKey = process.env.OPENAI_API_KEY;
const llm = new ChatOpenAI({ openAIApiKey });

// Enhanced session histories store
const sessionHistories = new Map();

// Enhanced function to get or create chat history for a session
function getSessionHistory(sessionId) {
    if (!sessionHistories.has(sessionId)) {
        sessionHistories.set(sessionId, new ChatMessageHistory());
    }
    return sessionHistories.get(sessionId);
}

// Improved standalone question template with better context handling
const standaloneQuestionTemplate = `Given the following conversation history and a question, 
convert the question to a standalone question that captures the full context of the conversation.
If the question is related to previous messages, incorporate that context.
If the question seems independent, keep it as is.

Chat History:
{history}

Current Question: {question}

Standalone question (incorporate context if needed):`;

const standaloneQuestionPrompt = PromptTemplate.fromTemplate(standaloneQuestionTemplate);

const standaloneQuestionChain = standaloneQuestionPrompt.pipe(llm).pipe(new StringOutputParser());

const retrievalChain = RunnableSequence.from([
    prevResult => prevResult.standalone_question,
    retriever,
    combineDocuments
]);

// Enhanced answer template with better context integration
const answerTemplate = `You are a helpful and enthusiastic support bot who can answer questions about Scrimba based on 
the context provided. Use the chat history to maintain conversation continuity.

Previous conversation history:
{history}

Retrieved context: {context}

Current question: {question}

Instructions:
1. Consider both the chat history and current question to maintain context
2. Reference previous interactions when relevant
3. Provide a coherent response that acknowledges any previous context
4. If the question relates to previous discussion, explicitly make those connections

Answer:`;

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

// Enhanced chain with message history
const chainWithHistory = new RunnableWithMessageHistory({
    runnable: chain,
    getMessageHistory: getSessionHistory,
    inputMessagesKey: "question",
    historyMessagesKey: "history",
});

// Enhanced conversation processing function
export async function progressConversation(question, sessionId) {
    try {
        // Get the history for this session
        const history = await getSessionHistory(sessionId);
        
        // Process the conversation
        const response = await chainWithHistory.invoke(
            { 
                question,
                history: await formatHistory(history)
            },
            { 
                configurable: { sessionId }
            }
        );
        
        // Save the interaction to history
        await history.addMessages([
            new HumanMessage(question),
            new AIMessage(response)
        ]);
        
        return response;
    } catch (error) {
        console.error('Error in conversation:', error);
        return "I'm sorry, I encountered an error. Please try again or contact support.";
    }
}

// Helper function to format history for the prompt
async function formatHistory(history) {
    const messages = await history.getMessages();
    if (messages.length === 0) return "No previous conversation.";
    
    return messages.map(msg => {
        const role = msg._getType() === 'human' ? 'Human' : 'Assistant';
        return `${role}: ${msg.content}`;
    }).join('\n');
}