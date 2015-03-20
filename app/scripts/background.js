"use strict";

(function() {

    var github_fs_ = new GithubFS();

    chrome.app.runtime.onLaunched.addListener(function() {
        chrome.app.window.create("window.html", {
            outerBounds: {
                width: 800,
                height: 500
            },
            resizable: false
        });
    });

    var doMount = function(request, sendResponse) {
        github_fs_.checkAlreadyMounted(request.username, request.repositoryName, request.branch, function(exists) {
            if (exists) {
                sendResponse({
                    type: "error",
                    error: "Already mounted"
                });
            } else {
                var options = {
                    username: request.username,
                    password: request.password,
                    repositoryName: request.repositoryName,
                    branch: request.branch,
                    onSuccess: function() {
                        sendResponse({
                            type: "mounted",
                            success: true
                        });
                    },
                    onError: function(reason) {
                        sendResponse({
                            type: "error",
                            success: false,
                            error: reason
                        });
                    }
                };
                github_fs_.mount(options);
            }
        });
    };

    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        console.log(request);
        switch(request.type) {
        case "mount":
            doMount(request, sendResponse);
            break;
        default:
            var message;
            if (request.type) {
                message = "Invalid request type: " + request.type + ".";
            } else {
                message = "No request type provided.";
            }
            sendResponse({
                type: "error",
                success: false,
                message: message
            });
            break;
        }
        return true;
    });

})();
