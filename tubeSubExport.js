    //Registering on the DOM done an IIFE
    $(function () {
        var primaryContainer = $("#primary");
        primaryContainer = primaryContainer.find("ytd-section-list-renderer");
        primaryContainer = primaryContainer.find("ytd-item-section-renderer");
        //primaryContainer = primaryContainer.find("#grid-container");
        var container = $('<ytd-subscribe-button-renderer/>', {
            id: 'sub-exporter-container',
            "class": "style-scope",
        }).prependTo(primaryContainer);
        var button = $('<paper-button/>', {
            id: 'sub-exporter-button',
            subscribed: "",
            "class": "style-scope ytd-subscribe-button-renderer",
        }).prependTo(container);
        var buttonText = $('<yt-formatted-string/>', {
            id: 'sub-exporter-button',
            "class": "style-scope ytd-subscribe-button-renderer",
        }).prependTo(button);
        buttonText.html("download subscriptions xml");
        button.click(function () {
            getSubsXML();
        }.bind(this));
    });

    //Get sub names and direct links
    function getSubsXML() {
        //Get the subscriptions
        var ytSubsRow = $("ytd-channel-renderer");
        var channelInfos = [];
        var channelLinks = {};
        var defs = [];
        for (var i = 0; i < ytSubsRow.length; i++) {
            channelInfos.push(ytSubsRow[i].childNodes[2].childNodes[1]);
        }
        var channelConunt = channelInfos.length;
        for (var i = 0; i < channelConunt; i++) {
            var channelName = channelInfos[i].childNodes[0].childNodes[0].childNodes[0].innerText.toString();
            var channelLink = channelInfos[i].childNodes[0].href;
            channelLinks[channelName] = channelLink;
        }
        //Channel name + links ready --> fetch canonical links where it's needed

        //Canonical link fetch where needed
        for (var key in channelLinks) {
            if (!(/\/channel\//i.test(channelLinks[key]))) {
                var dfd = $.Deferred();
                defs.push(dfd);
                $.ajax({
                    url: channelLinks[key],
                    context: {
                        def: dfd,
                        channelName: key,
                        channelLinks: channelLinks
                    },
                    success: function (data) {
                        var html = $.parseHTML(data);
                        for (var i = 0; i < html.length; i++) {
                            if (html[i].rel == "canonical") {
                                this.channelLinks[this.channelName] = html[i].href;
                                this.def.resolve("Fetched");
                            }
                        }
                    }
                });
            }
        }
        $.when.apply($, defs).done(function () {
            parseFeedLinks(channelLinks);
        }.bind(this));
    }

    //Modifies channel URLs to point to their feed
    function parseFeedLinks(channelLinks) {
        var xmlUrl = "https://www.youtube.com/feeds/videos.xml?channel_id=";
        for (var key in channelLinks) {
            var channelId = channelLinks[key].split("/").pop();
            channelLinks[key] = xmlUrl + channelId;
        }
        assembleXML(channelLinks);
    }

    function assembleXML(channelLinks) {
        var XML = [];
        var pre = '<opml version="1.1">\n<body><outline text="YouTube – subscriptions" title="YouTube – subscriptions">';
        var post = '</outline></body></opml>';
        var preCh = '<outline ';
        var postCh = '/>';
        var text = 'text="';
        var title = 'title="';
        var type = 'type="rss" ';
        var xmlUrl = 'xmlUrl="';
        //Assemble
        XML.push(pre);
        for (var key in channelLinks) {
            XML.push(preCh);
            XML.push(text);
            XML.push(key.toString() + '" ');
            XML.push(title);
            XML.push(key.toString() + '" ');
            XML.push(type);
            XML.push(xmlUrl);
            XML.push(channelLinks[key].toString() + '" ');
            XML.push(postCh);
        }
        XML.push(post);
        var finalXML = XML.join("");
        saveXML(finalXML);
    }

    function saveXML(XML) {
        var blob = new Blob([XML], {
            type: "application/rss+xml"
        });
        var element = document.createElement('a');
        element.setAttribute('href', URL.createObjectURL(blob));
        element.setAttribute('download', "subscription_manager.xml");
        element.style.display = 'none';
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
    };