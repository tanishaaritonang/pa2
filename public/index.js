// index.js
const button = document.getElementById('submit-btn');
const userInput = document.getElementById('user-input');
const chatbotConversation = document.getElementById('chatbot-conversation-container');

// Generate a session ID when the page loads
const sessionId = Date.now().toString();

button.addEventListener("click", (e) => {
    e.preventDefault();
    handleUserMessage();
});

// Also handle Enter key press
userInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
        e.preventDefault();
        handleUserMessage();
    }
});

async function handleUserMessage() {
    const question = userInput.value;
    if (!question.trim()) return; // Don't send empty messages
    
    userInput.value = ""; // Clear input field

    // Add human message to UI
    addMessageToUI(question, 'human');

    try {
        const response = await fetch('http://localhost:3000/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                question,
                sessionId // Send sessionId with each request
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
        }

        const responseData = await response.json();
        
        // Add AI response to UI
        addMessageToUI(responseData, 'ai');

    } catch (error) {
        console.error('Error fetching data:', error);
        // Show error message in UI
        addMessageToUI('Sorry, I encountered an error. Please try again.', 'ai', true);
    }
}

function addMessageToUI(message, sender, isError = false) {
    const newSpeechBubble = document.createElement("div");
    newSpeechBubble.classList.add("speech", `speech-${sender}`);
    if (isError) {
        newSpeechBubble.classList.add("error");
    }
    chatbotConversation.appendChild(newSpeechBubble);
    newSpeechBubble.textContent = message;
    
    // Scroll to bottom
    chatbotConversation.scrollTop = chatbotConversation.scrollHeight;
}

// Optional: Add loading indicator
function setLoading(isLoading) {
    button.disabled = isLoading;
    userInput.disabled = isLoading;
    if (isLoading) {
        button.textContent = "...";
    } else {
        button.textContent = "Send";
    }
}

// Optional: Add clear conversation functionality
function clearConversation() {
    chatbotConversation.innerHTML = '';
    sessionStorage.removeItem("sessionId"); // Reset session
    sessionId = Date.now().toString(); // Generate new session ID
    sessionStorage.setItem("sessionId", sessionId);
    // You might want to also send a request to the server to clear the session
    fetch('http://localhost:3000/clear-chat', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ sessionId })
    }).catch(error => console.error('Error clearing chat:', error));
}

// Optional: Add this to your HTML
//<button onclick="clearConversation()">Clear Chat</button>