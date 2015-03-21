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
            contentType: "application/octet-stream",
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
            request.url = appendTimestamp(options.url);
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
