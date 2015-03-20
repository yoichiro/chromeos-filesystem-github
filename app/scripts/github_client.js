(function() {

    // Constants

    var API_URL = "https://api.github.com";

    // Constructor

    var GithubClient = function(username, password, repositoryName, branch) {
        this.username_ = username;
        this.password_ = password;
        this.repositoryName_ = repositoryName;
        this.branch_ = branch;
        this.writeRequestMap = {};
        initializeJQueryAjaxBinaryHandler.call(this);
    };

    // Public functions

    GithubClient.prototype.getUsername = function() {
        return this.username_;
    }

    GithubClient.prototype.getPassword = function() {
        return this.password_;
    }

    GithubClient.prototype.getRepositoryName = function() {
        return this.repositoryName_;
    }

    GithubClient.prototype.getBranch = function() {
        return this.branch_;
    }

    GithubClient.prototype.test = function() {
        console.log("test");
        console.log(createBasicCredential.call(this));
        this.getRepositories(function(repos) {
            console.log(repos);
        }.bind(this), function(error) {
            console.log(error);
        }.bind(this));
        this.getBranches("test-repository", function(branches) {
            console.log(branches);
        }.bind(this), function(error) {
            console.log(error);
        }.bind(this));
        this.readDirectory("test-repository", "master", "/", function(result) {
            console.log(result);
        }.bind(this), function(error) {
            console.log(error);
        }.bind(this));
        this.getMetadata("test-repository", "master", "/hoge.txt", function(result) {
            console.log(result);
        }.bind(this), function(error) {
            console.log(error);
        }.bind(this));
        this.readFile("test-repository", "master", "/hoge.txt", function(result) {
            console.log(result.byteLength);
        }.bind(this), function(error) {
            console.log(error);
        }.bind(this));
        this.createDirectory("test-repository", "master", "/dirtest", function(result) {
            console.log(result);
        }.bind(this), function(error) {
            console.log(error);
        }.bind(this));
        /*
        this.deleteFile("test-repository", "master", "/dirtest/.gitkeep", function(result) {
            console.log(result);
        }.bind(this), function(error) {
            console.log(error);
        }.bind(this));
         */
        this.moveFile("test-repository", "master", "/source/aaa", "/target/aaa", function() {
            console.log();
        }.bind(this), function(error) {
            console.log(error);
        }.bind(this));
    };

    GithubClient.prototype.getRepositories = function(onSuccess, onError) {
        sendGetRequest.call(this, {
            path: "/user/repos",
            onSuccess: function(result) {
                var repos = map(result, function(item) {
                    return item.name;
                });
                onSuccess(repos);
            }.bind(this),
            onError: function(error) {
                console.log(error);
            }.bind(this)
        });
    };

    GithubClient.prototype.getBranches = function(repositoryName, onSuccess, onError) {
        sendGetRequest.call(this, {
            path: "/repos/" + this.username_ + "/" + repositoryName + "/branches",
            onSuccess: function(result) {
                var branches = map(result, function(item) {
                    return item.name;
                });
                onSuccess(branches);
            }.bind(this),
            onError: function(error) {
                console.log(error);
            }.bind(this)
        });
    };

    // Must specify "DIR PATH" not "FILE PATH".
    // options: directoryPath, onSuccess, onError
    GithubClient.prototype.readDirectory = function(options) {
        sendGetRequest.call(this, {
            path: createRepositoryPath.call(this) + "/contents" + options.directoryPath + "?ref=" + this.branch_,
            onSuccess: function(result) {
                var metadataList = map(result, function(item) {
                    if (item.type === "dir") {
                        return {
                            isDirectory: true,
                            name: item.name,
                            size: 0,
                            modificationTime: new Date()
                        };
                    } else if (item.type === "file") {
                        return {
                            isDirectory: false,
                            name: item.name,
                            size: item.size,
                            modificationTime: new Date(),
                            downloadUrl: item.download_url
                        };
                    } else {
                        return null;
                    }
                });
                options.onSuccess(metadataList);
            }.bind(this),
            onError: function(error) {
                options.onError(error);
            }.bind(this)
        });
    };

    // Must specify "FILE PATH" not "DIR PATH".
    // options: entryPath, onSuccess, onError
    /*
    GithubClient.prototype.getMetadata = function(options) {
        if (options.entryPath === "/") {
            var metadata = {
                isDirectory: true,
                name: "",
                size: 0,
                modificationTime: new Date()
            };
            options.onSuccess(metadata);
        } else {
            sendGetRequest.call(this, {
                path: createRepositoryPath.call(this) + "/contents" + options.entryPath + "?ref=" + this.branch_,
                onSuccess: function(item) {
                    var metadata = {
                        isDirectory: false,
                        name: item.name,
                        size: item.size,
                        modificationTime: new Date()
                    };
                    options.onSuccess(metadata);
                }.bind(this),
                onError: function(error) {
                    console.log(error);
                    options.onError(error);
                }.bind(this)
            });
        }
    };
    */

    GithubClient.prototype.openFile = function(filePath, requestId, mode, onSuccess, onError) {
        this.writeRequestMap[requestId] = {
            mode: mode
        };
        onSuccess();
    };

    GithubClient.prototype.readFile = function(options) {
        sendGetRequest.call(this, {
            url: options.downloadUrl,
            accept: "application/vnd.github.v3.raw",
            dataType: "binary",
            responseType: "arraybuffer",
            range: [options.offset, options.length],
            onSuccess: function(data) {
                options.onSuccess(data);
            }.bind(this),
            onError: function(error) {
                console.log(error);
                options.onError(error);
            }.bind(this)
        });
    };

    GithubClient.prototype.closeFile = function(options) {
        delete this.writeRequestMap[options.requestId];
        options.onSuccess();
    };

/*
    GithubClient.prototype.createDirectory = function(repositoryName, branch, dirPath, onSuccess, onError) {
        sendPutRequest.call(this, {
            path: "/repos/" + this.username_ + "/" + repositoryName + "/contents" + dirPath + "/.gitkeep",
            data: {
                message: "Created " + dirPath + " directory.",
                content: "",
                branch: branch
            },
            onSuccess: function(result) {
                console.log(result);
            }.bind(this),
            onError: function(error) {
                console.log(error);
            }.bind(this)
        });
    };

    GithubClient.prototype.deleteFile = function(repositoryName, branch, filePath, onSuccess, onError) {
        getSha.call(this, repositoryName, branch, filePath, function(sha) {
            sendDeleteRequest.call(this, {
                path: "/repos/" + this.username_ + "/" + repositoryName + "/contents" + filePath,
                data: {
                    message: "Deleted " + filePath + " file.",
                    branch: branch,
                    sha: sha
                },
                onSuccess: function(result) {
                    console.log(result);
                }.bind(this),
                onError: function(error) {
                    console.log(error);
                }.bind(this)
            });
        }.bind(this), function(error) {
            console.log(error);
        }.bind(this));
    };

    GithubClient.prototype.moveFile = function(repositoryName, branch, sourcePath, targetPath, onSuccess, onError) {
        getLatestCommitSha.call(this, repositoryName, branch, function(latestCommitSha) {
            getTree.call(this, repositoryName, latestCommitSha, true, function(tree) {
                forEach(tree, function(ref) {
                    console.log(ref);
                    if (ref.path === sourcePath.substring(1)) {
                        ref.path = targetPath.substring(1);
                    }
                }.bind(this));
                postTree.call(this, repositoryName, tree, function(rootTree) {
                    commit.call(
                        this, repositoryName, latestCommitSha, rootTree,
                        "Moved " + sourcePath + " to " + targetPath + ".",
                        function(commit) {
                            updateHead.call(this, repositoryName, branch, commit, function() {
                                this.deleteFile(repositoryName, branch, sourcePath, function() {
                                    onSuccess();
                                }.bind(this), function(error) {
                                    console.log(error);
                                }.bind(this));
                            }.bind(this), function(error) {
                                console.log(error);
                            }.bind(this));
                        }.bind(this), function(error) {
                            console.log(error);
                        }.bind(this));
                }.bind(this), function(error) {
                    console.log(error);
                }.bind(this));
            }.bind(this), function(error) {
                console.log(error);
            });
        }.bind(this), function(error) {
            console.log(error);
        }.bind(this));
    };
*/

    // Private functions

    var createBasicCredential = function() {
        var credential = btoa(this.username_ + ":" + this.password_);
        return "Basic " + credential;
    };

    var createRepositoryPath = function() {
        return "/repos/" + this.username_ + "/" + this.repositoryName_;
    }

    var sendRequest = function(options) {
        var request = {
            type: options.method,
            dataType: options.dataType,
            headers: {
                "Authorization": createBasicCredential.call(this),
                "Accept": options.accept,
                "Content-Type": options.contentType
            }
        };
        if (options.path) {
            request.url = API_URL + options.path;
        }
        if (options.url) {
            request.url = options.url;
        }
        if (options.responseType) {
            request.responseType = options.responseType;
        }
        if (options.data) {
            request.data = options.data;
        }
        if (options.range) { // [offset, length]
            request.headers["Range"] = "bytes=" + options.range[0] + "-" + (options.range[0] + options.range[1] - 1);
        }
        $.ajax(request).done(function(result) {
            options.onSuccess(result);
        }.bind(this)).fail(function(error) {
            options.onError(error);
        }.bind(this));
    };

    var sendGetRequest = function(options) {
        var request = {
            method: "GET",
            dataType: options.dataType || "json",
            accept: options.accept || "application/vnd.github.v3+json",
            contentType: options.contentType || "application/json",
            onSuccess: options.onSuccess,
            onError: options.onError
        };
        if (options.path) {
            request.path = appendTimestamp(options.path);
        }
        if (options.url) {
            request.url = options.url;
        }
        if (options.responseType) {
            request.responseType = options.responseType;
        }
        if (options.range) {
            request.range = options.range;
        }
        sendRequest.call(this, request);
    };

    var sendPutRequest = function(options) {
        var request = {
            method: "PUT",
            path: options.path,
            dataType: options.dataType || "json",
            accept: options.accept || "application/vnd.github.v3+json",
            contentType: options.contentType || "application/json",
            data: JSON.stringify(options.data),
            onSuccess: options.onSuccess,
            onError: options.onError
        };
        sendRequest.call(this, request);
    };

    var sendDeleteRequest = function(options) {
        var request = {
            method: "DELETE",
            path: options.path,
            dataType: options.dataType || "json",
            accept: options.accept || "application/vnd.github.v3+json",
            contentType: options.contentType || "application/json",
            data: JSON.stringify(options.data),
            onSuccess: options.onSuccess,
            onError: options.onError
        };
        sendRequest.call(this, request);
    };

    var sendPostRequest = function(options) {
        var request = {
            method: "POST",
            path: options.path,
            dataType: options.dataType || "json",
            accept: options.accept || "application/vnd.github.v3+json",
            contentType: options.contentType || "application/json",
            data: JSON.stringify(options.data),
            onSuccess: options.onSuccess,
            onError: options.onError
        };
        sendRequest.call(this, request);
    };

    var sendPatchRequest = function(options) {
        var request = {
            method: "PATCH",
            path: options.path,
            dataType: options.dataType || "json",
            accept: options.accept || "application/vnd.github.v3+json",
            contentType: options.contentType || "application/json",
            data: JSON.stringify(options.data),
            onSuccess: options.onSuccess,
            onError: options.onError
        };
        sendRequest.call(this, request);
    };

    var appendTimestamp = function(url) {
        if (url.indexOf("?") == -1) {
            return url + "?" + (new Date()).getTime();
        } else {
            return url + "&" + (new Date()).getTime();
        }
    };

    var getSha = function(repositoryName, branch, filePath, onSuccess, onError) {
        sendGetRequest.call(this, {
            path: "/repos/" + this.username_ + "/" + repositoryName + "/contents" + filePath + "?ref=" + branch,
            onSuccess: function(item) {
                console.log(item);
                onSuccess(item.sha);
            }.bind(this),
            onError: function(error) {
                console.log(error);
            }.bind(this)
        });
    };

    var getLatestCommitSha = function(repositoryName, branch, onSuccess, onError) {
        sendGetRequest.call(this, {
            path: "/repos/" + this.username_ + "/" + repositoryName + "/git/refs/heads/" + branch,
            onSuccess: function(ref) {
                console.log(ref);
                onSuccess(ref.object.sha);
            }.bind(this),
            onError: function(error) {
                console.log(error);
            }.bind(this)
        });
    };

    var getTree = function(repositoryName, tree, recursive, onSuccess, onError) {
        var path = "/repos/" + this.username_ + "/" + repositoryName + "/git/trees/" + tree;
        if (recursive) {
            path += "?recursive=1";
        }
        sendGetRequest.call(this, {
            path: path,
            onSuccess: function(result) {
                onSuccess(result.tree);
            }.bind(this),
            onError: function(error) {
                console.log(error);
            }.bind(this)
        });
    };

    var postTree = function(repositoryName, tree, onSuccess, onError) {
        sendPostRequest.call(this, {
            path: "/repos/" + this.username_ + "/" + repositoryName + "/git/trees",
            data: {
                tree: tree
            },
            onSuccess: function(result) {
                console.log(result);
                onSuccess(result.sha);
            }.bind(this),
            onError: function(error) {
                console.log(error);
            }.bind(this)
        });
    };

    var commit = function(repositoryName, parent, tree, message, onSuccess, onError) {
        var data = {
            message: message,
            author: {
                name: "Yoichiro Tanaka",
                email: "yoichiro@eisbahn.jp"
            },
            parents: [
                parent
            ],
            tree: tree
        };
        sendPostRequest.call(this, {
            path: "/repos/" + this.username_ + "/" + repositoryName + "/git/commits",
            data: data,
            onSuccess: function(result) {
                onSuccess(result.sha);
            }.bind(this),
            onError: function(error) {
                console.log(error);
            }.bind(this)
        });
    };

    var updateHead = function(repositoryName, head, commit, onSuccess) {
        sendPatchRequest.call(this, {
            path: "/repos/" + this.username_ + "/" + repositoryName + "/git/refs/heads/" + head,
            data: {
                sha: commit
            },
            onSuccess: function(result) {
                onSuccess();
            }.bind(this),
            onError: function(error) {
                console.log(error);
            }.bind(this)
        });
    };

    var initializeJQueryAjaxBinaryHandler = function() {
        $.ajaxTransport("+binary", function(options, originalOptions, jqXHR){
            if (window.FormData &&
                ((options.dataType && (options.dataType === 'binary')) ||
                 (options.data && ((window.ArrayBuffer && options.data instanceof ArrayBuffer) ||
                                   (window.Blob && options.data instanceof Blob))))) {
                return {
                    send: function(_, callback){
                        var xhr = new XMLHttpRequest(),
                            url = options.url,
                            type = options.type,
                            dataType = options.responseType || "blob",
                            data = options.data || null;
                        xhr.addEventListener('load', function(){
                            var data = {};
                            data[options.dataType] = xhr.response;
                            callback(xhr.status, xhr.statusText, data, xhr.getAllResponseHeaders());
                        });
                        xhr.open(type, url, true);
                        for (var key in options.headers) {
                            xhr.setRequestHeader(key, options.headers[key]);
                        }
                        xhr.responseType = dataType;
                        xhr.send(data);
                    },
                    abort: function(){
                        jqXHR.abort();
                    }
                };
            }
        });
    };

    var map = function(array, fn) {
        var result = [];
        forEach(array, function(item) {
            var obj = fn(item);
            if (obj) {
                this.push(obj);
            }
        }, result);
        return result;
    };

    var forEach = function(array, fn, context) {
        for (var i = 0; i < array.length; i++) {
            fn.call(context, array[i], i);
        }
    };

    // Export

    window.GithubClient = GithubClient;

})();
