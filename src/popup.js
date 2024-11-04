document.addEventListener("DOMContentLoaded", () => {
  console.log("Popup loaded");

  const savedBackendUrl = localStorage.getItem("backendUrl");
  const analyzeSection = document.getElementById("analyzeSection");
  const analyzeBtn = document.getElementById("analyzeBtn");
  const backendUrlSection = document.getElementById("backendUrlSection");
  
  // Initial setup based on whether the backend URL is saved
  if (!savedBackendUrl) {
    console.log("No backend URL found. Showing URL input section.");
    backendUrlSection.classList.remove("hidden");
    analyzeSection.classList.add("hidden");
  } else {
    console.log("Backend URL found:", savedBackendUrl);
    backendUrlSection.classList.add("hidden");
    analyzeSection.classList.remove("hidden");
  }

  // Save URL button click handler
  document.getElementById("saveUrlBtn").addEventListener("click", () => {
    const backendUrl = document.getElementById("backendUrl").value;
    if (backendUrl) {
      localStorage.setItem("backendUrl", backendUrl);
      console.log("Backend URL saved:", backendUrl);
      
      // Hide URL input and show analyze section
      backendUrlSection.classList.add("hidden");
      analyzeSection.classList.remove("hidden");
    } else {
      alert("Please enter a valid backend URL.");
    }
  });

  // Analyze button click handler
  analyzeBtn.addEventListener("click", () => {
    const backendUrl = localStorage.getItem("backendUrl");

    if (!backendUrl) {
      alert("Please enter and save the backend URL first.");
      return;
    }

    console.log("Analyze button clicked.");

    document.getElementById("loading").classList.remove("hidden");
    document.getElementById("resultSection").classList.add("hidden");

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { action: "extractComments" }, (response) => {
        if (chrome.runtime.lastError) {
          console.error("Could not send message:", chrome.runtime.lastError);
          document.getElementById("loading").classList.add("hidden");
          return;
        }
        
        if (response && response.comments) {
          console.log("Extracted comments:", response.comments);
          checkExistingComments(response.comments, response.blogPostUrl, backendUrl);
        } else {
          console.error("Failed to extract comments.");
          document.getElementById("loading").classList.add("hidden");
        }
      });
    });
  });

  async function checkExistingComments(comments, blogPostUrl, backendUrl) {
    console.log("Checking for existing comments in Couchbase...");
    try {
      const response = await fetch(`${backendUrl}/check-existing-comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ blogPostUrl }),
      });

      const result = await response.json();
      if (result.success) {
        console.log("Existing comments found:", result.existingCommentIds);
        const newComments = comments.filter(comment => {
          const commentId = `comment::${encodeURIComponent(blogPostUrl)}::${comment.id}`;
          return !result.existingCommentIds.includes(commentId);
        });

        console.log("New comments to process:", newComments);
        await processNewComments(newComments, blogPostUrl, backendUrl);
        await analyzeSimilarity(blogPostUrl, backendUrl);
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      console.error("Error checking existing comments:", error);
      document.getElementById("loading").classList.add("hidden");
    }
  }

  async function processNewComments(comments, blogPostUrl, backendUrl) {
    if (comments.length === 0) {
      console.log("All comments are already stored, no new comments to process.");
      return;
    }

    console.log("Sending new comments to backend for embedding...");

    for (const [index, comment] of comments.entries()) {
      try {
        const response = await fetch(`${backendUrl}/store-embedding`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ comment, blogPostUrl }),
        });

        const result = await response.json();
        if (result.success) {
          console.log(result.message);
        } else {
          throw new Error(result.message);
        }
      } catch (error) {
        console.error(`Error processing comment ${index + 1}:`, error);
      }
    }
  }

  async function analyzeSimilarity(blogPostUrl, backendUrl) {
    console.log("Analyzing similarity of comments...");

    try {
      const response = await fetch(`${backendUrl}/analyze-similarity`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ blogPostUrl, threshold: 0.8 }),
      });

      const result = await response.json();
      if (result.success) {
        console.log("Analysis results:", result);
        document.getElementById("quality").innerText = `${result.similarPercentage}%`;
        document.getElementById("similar").innerText = `Similar: ${result.similarPercentage}%`;
        document.getElementById("dissimilar").innerText = `Dissimilar: ${result.dissimilarPercentage}%`;
        document.getElementById("resultSection").classList.remove("hidden");
      } else {
        console.error("Failed to analyze similarity:", result.message);
      }
    } catch (error) {
      console.error("Error analyzing similarity:", error);
    } finally {
      document.getElementById("loading").classList.add("hidden");
    }
  }
});
