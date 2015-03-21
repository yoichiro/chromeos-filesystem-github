"use strict";

(function() {

    // Constructor

    var GithubFS = function() {
        this.githubClientMap_ = {};
        this.opened_files_ = {};
        this.metadataCache_ = {};
        assignEventHandlers.call(this);
    };

    // Public functions

    // options: username, password, repositoryName, branch, onSuccess
    GithubFS.prototype.mount = function(options) {
        var fileSystemId = createFileSystemID.call(
            this, options.username, options.repositoryName, options.branch);
        var githubClient = new GithubClient(
            options.username, options.password,
            options.repositoryName, options.branch);
        this.githubClientMap_[fileSystemId] = githubClient;
        doMount.call(
            this,
            options.username,
            options.password,
            options.repositoryName,
            options.branch,
            function() {
                options.onSuccess();
            }.bind(this));
    };

    GithubFS.prototype.resume = function(fileSystemId, onSuccess, onError) {
        console.log("resume - start");
        getMountedCredential.call(this, fileSystemId, function(credential) {
            if (credential) {
                this.mount({
                    username: credential.username,
                    password: credential.password,
                    repositoryName: credential.repositoryName,
                    branch: credential.branch,
                    onSuccess: function() {
                        onSuccess();
                    }.bind(this)
                });
            } else {
                onError("Credential[" + fileSystemId + "] not found");
            }
        }.bind(this));
    };

    GithubFS.prototype.onUnmountRequested = function(options, successCallback, errorCallback) {
        console.log("onUnmountRequested");
        console.log(options);
        var githubClient = getGithubClient.call(this, options.fileSystemId);
        doUnmount.call(this, githubClient, options.requestId, successCallback);
    };

    GithubFS.prototype.onReadDirectoryRequested = function(options, successCallback, errorCallback) {
        console.log("onReadDirectoryRequested");
        console.log(options);
        readDirectory.call(this, options.fileSystemId, options.directoryPath, function(metadataList) {
            successCallback(metadataList, false);
        }.bind(this), function(reason) {
            console.log(reason);
            errorCallback("FAILED");
        }.bind(this));
    };

    var getMetadata = function(fileSystemId, entryPath, onSuccess, onError) {
        var githubClient = getGithubClient.call(this, fileSystemId);
        var metadataCache = getMetadataCache.call(this, fileSystemId);
        var cache = metadataCache.get(entryPath);
        if (cache.directoryExists && cache.fileExists) {
            console.log("Cache hit");
            console.log(cache.metadata);
            onSuccess(cache.metadata);
        } else {
            var lastSlashPos = entryPath.lastIndexOf("/");
            var parentPath;
            var fileName;
            if (lastSlashPos === 0) {
                parentPath = "/";
                fileName = entryPath.substring(1);
            } else {
                parentPath = entryPath.substring(0, lastSlashPos);
                fileName = entryPath.substring(lastSlashPos + 1);
            }
            readDirectory.call(this, fileSystemId, parentPath, function(metadataList) {
                for (var i = 0; i < metadataList.length; i++) {
                    var metadata = metadataList[i];
                    if (metadata.name === fileName) {
                        console.log(metadata);
                        onSuccess(metadata);
                        return;
                    }
                }
                onError("NOT_FOUND");
            }.bind(this), function(reason) {
                console.log(reason);
                onError("FAILED");
            }.bind(this));
        }
    }

    GithubFS.prototype.onGetMetadataRequested = function(options, successCallback, errorCallback) {
        console.log("onGetMetadataRequested: thumbnail=" + options.thumbnail);
        console.log(options);
        if (options.entryPath === "/") {
            var metadata = {
                isDirectory: true,
                name: "",
                size: 0,
                modificationTime: new Date()
            };
            successCallback(metadata);
        } else {
            getMetadata.call(this, options.fileSystemId, options.entryPath, function(metadata) {
                successCallback(metadata);
            }.bind(this), function(reason) {
                errorCallback(reason);
            }.bind(this));
        }
    };

    GithubFS.prototype.onOpenFileRequested = function(options, successCallback, errorCallback) {
        console.log("onOpenFileRequested");
        console.log(options);
        getMetadata.call(this, options.fileSystemId, options.filePath, function(metadata) {
            var githubClient = getGithubClient.call(this, options.fileSystemId);
            githubClient.openFile(options.filePath, options.requestId, options.mode, function() {
                var openedFiles = getOpenedFiles.call(this, options.fileSystemId);
                openedFiles[options.requestId] = {
                    path: options.filePath,
                    downloadUrl: metadata.downloadUrl
                };
                successCallback();
            }.bind(this));
        }.bind(this), function(reason) {
            errorCallback(reason);
        }.bind(this));
    };

    GithubFS.prototype.onReadFileRequested = function(options, successCallback, errorCallback) {
        console.log("onReadFileRequested - start");
        console.log(options);
        var fileInfo = getOpenedFiles.call(this, options.fileSystemId)[options.openRequestId];
        var githubClient = getGithubClient.call(this, options.fileSystemId);
        githubClient.readFile({
            requestId: options.openRequestId,
            path: fileInfo.path,
            downloadUrl: fileInfo.downloadUrl,
            offset: options.offset,
            length: options.length,
            onSuccess: function(result) {
                console.log(result);
                console.log(result.byteLength);
                successCallback(result, false);
            }.bind(this),
            onError: function(reason) {
                console.log(reason);
                errorCallback("FAILED");
            }
        });
    };

    GithubFS.prototype.onCloseFileRequested = function(options, successCallback, errorCallback) {
        console.log("onCloseFileRequested");
        var githubClient = getGithubClient.call(this, options.fileSystemId);
        githubClient.closeFile({
            requestId: options.openRequestId,
            onSuccess: function() {
                var openedFiles = getOpenedFiles.call(this, options.fileSystemId);
                delete openedFiles[options.openRequestId];
                successCallback();
            }.bind(this)
        });
    };

    GithubFS.prototype.checkAlreadyMounted = function(username, repositoryName, branch, callback) {
        var fileSystemId = createFileSystemID.call(this, username, repositoryName, branch);
        chrome.fileSystemProvider.getAll(function(fileSystems) {
            for (var i = 0; i < fileSystems.length; i++) {
                if (fileSystems[i].fileSystemId === fileSystemId) {
                    callback(true);
                    return;
                }
            }
            callback(false);
        }.bind(this));
    };

    // Private functions

    var doMount = function(username, password, repositoryName, branch, callback) {
        this.checkAlreadyMounted(username, repositoryName, branch, function(exists) {
            if (!exists) {
                var fileSystemId = createFileSystemID.call(this, username, repositoryName, branch);
                var displayName = username + "/" + repositoryName;
                displayName += " (" + branch + ")";
                chrome.fileSystemProvider.mount({
                    fileSystemId: fileSystemId,
                    displayName: displayName,
                    writable: false
                }, function() {
                    registerMountedCredential(
                        username, password, repositoryName, branch,
                        function() {
                            callback();
                        }.bind(this));
                }.bind(this));
            } else {
                callback();
            }
        }.bind(this));
    };

    var doUnmount = function(githubClient, requestId, onSuccess) {
        console.log("doUnmount");
        _doUnmount.call(
            this,
            githubClient.getUsername(),
            githubClient.getPassword(),
            githubClient.getRepositoryName(),
            githubClient.getBranch(),
            function() {
                onSuccess();
            }.bind(this));
    };

    var _doUnmount = function(username, password, repositoryName, branch, onSuccess) {
        console.log("_doUnmount");
        unregisterMountedCredential.call(
            this, username, repositoryName, branch,
            function() {
                var fileSystemId = createFileSystemID.call(this, username, repositoryName, branch);
                console.log(fileSystemId);
                chrome.fileSystemProvider.unmount({
                    fileSystemId: fileSystemId
                }, function() {
                    delete this.githubClientMap_[fileSystemId];
                    deleteMetadataCache.call(this, fileSystemId);
                    onSuccess();
                }.bind(this));
            }.bind(this));
    };

    var registerMountedCredential = function(
            username, password, repositoryName, branch, callback) {
        var fileSystemId = createFileSystemID.call(this, username, repositoryName, branch);
        chrome.storage.local.get("mountedCredentials", function(items) {
            var mountedCredentials = items.mountedCredentials || {};
            mountedCredentials[fileSystemId] = {
                username: username,
                password: password,
                repositoryName: repositoryName,
                branch: branch
            };
            chrome.storage.local.set({
                mountedCredentials: mountedCredentials
            }, function() {
                callback();
            }.bind(this));
        }.bind(this));
    };

    var unregisterMountedCredential = function(serverName, serverPort, username, callback) {
        var fileSystemId = createFileSystemID.call(this, serverName, serverPort, username);
        chrome.storage.local.get("mountedCredentials", function(items) {
            var mountedCredentials = items.mountedCredentials || {};
            delete mountedCredentials[fileSystemId];
            chrome.storage.local.set({
                mountedCredentials: mountedCredentials
            }, function() {
                callback();
            }.bind(this));
        }.bind(this));
    };

    var getMountedCredential = function(fileSystemId, callback) {
        chrome.storage.local.get("mountedCredentials", function(items) {
            var mountedCredentials = items.mountedCredentials || {};
            var credential = mountedCredentials[fileSystemId];
            callback(credential);
        }.bind(this));
    };

    var createFileSystemID = function(username, repositoryName, branch) {
        var id = "githubfs://" + username + "/" + repositoryName + "/" + branch;
        return id;
    };

    var createEventHandler = function(callback) {
        return function(options, successCallback, errorCallback) {
            var fileSystemId = options.fileSystemId;
            var githubClient = getGithubClient.call(this, fileSystemId);
            if (!githubClient) {
                this.resume(fileSystemId, function() {
                    callback(options, successCallback, errorCallback);
                }.bind(this), function(reason) {
                    console.log("resume failed: " + reason);
                    chrome.notifications.create("", {
                        type: "basic",
                        title: "File System for Github",
                        message: "Resuming connection failed. Unmount.",
                        iconUrl: "/images/48.png"
                    }, function(notificationId) {
                    }.bind(this));
                    getMountedCredential.call(this, fileSystemId, function(credential) {
                        if (credential) {
                            _doUnmount.call(
                                this,
                                credential.username,
                                credential.repositoryName,
                                credential.branch,
                                function() {
                                    errorCallback("FAILED");
                                }.bind(this));
                        } else {
                            console.log("Credential for [" + fileSystemId + "] not found.");
                            errorCallback("FAILED");
                        }
                    }.bind(this));
                }.bind(this));
            } else {
                callback(options, successCallback, errorCallback);
            }
        }.bind(this);
    };

    var assignEventHandlers = function() {
        chrome.fileSystemProvider.onUnmountRequested.addListener(
            function(options, successCallback, errorCallback) { // Unmount immediately
                var fileSystemId = options.fileSystemId;
                var githubClient = getGithubClient.call(this, fileSystemId);
                if (!githubClient) {
                    this.resume(fileSystemId, function() {
                        this.onUnmountRequested(options, successCallback, errorCallback);
                    }.bind(this), function(reason) {
                        console.log("resume failed: " + reason);
                        errorCallback("FAILED");
                    }.bind(this));
                } else {
                    this.onUnmountRequested(options, successCallback, errorCallback);
                }
            }.bind(this));
        chrome.fileSystemProvider.onReadDirectoryRequested.addListener(
            createEventHandler.call(this, function(options, successCallback, errorCallback) {
                this.onReadDirectoryRequested(options, successCallback, errorCallback);
            }.bind(this)));
        chrome.fileSystemProvider.onGetMetadataRequested.addListener(
            createEventHandler.call(this, function(options, successCallback, errorCallback) {
                this.onGetMetadataRequested(options, successCallback, errorCallback);
            }.bind(this)));
        chrome.fileSystemProvider.onOpenFileRequested.addListener(
            createEventHandler.call(this, function(options, successCallback, errorCallback) {
                this.onOpenFileRequested(options, successCallback, errorCallback);
            }.bind(this)));
        chrome.fileSystemProvider.onReadFileRequested.addListener(
            createEventHandler.call(this, function(options, successCallback, errorCallback) {
                this.onReadFileRequested(options, successCallback, errorCallback);
            }.bind(this)));
        chrome.fileSystemProvider.onCloseFileRequested.addListener(
            createEventHandler.call(this, function(options, successCallback, errorCallback) {
                this.onCloseFileRequested(options, successCallback, errorCallback);
            }.bind(this)));
    };

    var getGithubClient = function(fileSystemID) {
        var githubClient = this.githubClientMap_[fileSystemID];
        return githubClient;
    };

    var getOpenedFiles = function(fileSystemId) {
        var openedFiles = this.opened_files_[fileSystemId];
        if (!openedFiles) {
            openedFiles = {};
            this.opened_files_[fileSystemId] = openedFiles;
        }
        return openedFiles;
    };

    var getMetadataCache = function(fileSystemId) {
        var metadataCache = this.metadataCache_[fileSystemId];
        if (!metadataCache) {
            metadataCache = new MetadataCache();
            this.metadataCache_[fileSystemId] = metadataCache;
            console.log("getMetadataCache: Created. " + fileSystemId);
        }
        return metadataCache;
    };

    var deleteMetadataCache = function(fileSystemId) {
        console.log("deleteMetadataCache: " + fileSystemId);
        delete this.metadataCache_[fileSystemId];
    };

    var readDirectory = function(fileSystemId, directoryPath, onSuccess, onError) {
        var githubClient = getGithubClient.call(this, fileSystemId);
        githubClient.readDirectory({
            directoryPath: directoryPath,
            onSuccess: function(metadataList) {
                console.log(metadataList);
                var metadataCache = getMetadataCache.call(this, fileSystemId);
                metadataCache.put(directoryPath, metadataList);
                onSuccess(metadataList);
            }.bind(this),
            onError: function(reason) {
                onError(reason);
            }
        });
    }

    // Export

    window.GithubFS = GithubFS;

})();
