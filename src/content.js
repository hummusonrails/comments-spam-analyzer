function getDevtoComments() {
    const comments = [];
  
    const commentElements = document.querySelectorAll(".comment__body");
    
    commentElements.forEach((element) => {
      const commentText = element.innerText.trim();
      comments.push({
        text: commentText
      });
    });
  
    return comments;
  }
  
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "extractComments") {
      const comments = [];
      
      document.querySelectorAll("div.comment__body").forEach((commentElement, index) => {
        const commentText = commentElement.innerText.trim();
        
        const commentId = commentElement.closest("div[data-comment-id]")?.dataset.commentId || index + 1;
  
        comments.push({
          id: commentId,
          text: commentText
        });
      });
  
      sendResponse({ comments: comments, blogPostUrl: window.location.href });
    }
  });
  
  
  
  