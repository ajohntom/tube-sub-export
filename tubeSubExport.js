    //Registering on the DOM done an IIFE
    $(function () {
        var primaryContainer = $("#primary");
        primaryContainer = primaryContainer.find("ytd-section-list-renderer");
        primaryContainer = primaryContainer.find("ytd-item-section-renderer");
        //primaryContainer = primaryContainer.find("#grid-container");
        var container = $('<div/>', {
            id: 'sub-exporter-container',
            "class": "style-scope",
        }).prependTo(primaryContainer);
        var button = $('<div/>', {
            id: 'sub-exporter-button',
            "class": "style-scope",
        }).prependTo(container);
        var buttonText = $('<span/>', {
            id: 'sub-exporter-button-text',
            "class": "style-scope",
        }).prependTo(button);
        buttonText.html("download subscriptions xml");
        button.click(function () {
            getSubsXML();
        }.bind(this));
        var progressBarContainer = $('<div/>', {
            id: 'sub-exporter-progressbar-container',
            "class": "style-scope hidden",
        }).prependTo(container);
        var progressBarLabel = $('<label/>',{
            id: 'sub-exporter-progressbar-label',
            "for": 'sub-exporter-progressbar'
        }).prependTo(progressBarContainer);
        progressBarLabel.html("Progress:")
        var progressBar = $('<meter/>', {
            id: 'sub-exporter-progressbar',
            "class": "style-scope",
            min: 0,
            max: 100,
            value: 0
        }).prependTo(progressBarContainer);
    });

    //Get sub names and direct links
    function getSubsXML() {
        //Reset meter
        $("#sub-exporter-progressbar").attr("value", 0);
        //Show progress bar upon fetch start
        $("#sub-exporter-progressbar-container").toggleClass("hidden");
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
                        channelLinks: channelLinks,
                        channelConunt: channelConunt,
                    },
                    success: function (data) {
                        var html = $.parseHTML(data);
                        for (var i = 0; i < html.length; i++) {
                            if (html[i].rel == "canonical") {
                                this.channelLinks[this.channelName] = html[i].href;
                                this.def.resolve("Fetched");
                                var value = parseFloat($("#sub-exporter-progressbar").attr("value"));
                                console.log(value, 1/this.channelConunt*100);
                                $("#sub-exporter-progressbar").attr("value", value + (1/this.channelConunt*100));
                            }
                        }
                    }
                });
            }
            else{
                var value = parseFloat($("#sub-exporter-progressbar").attr("value"));
                $("#sub-exporter-progressbar").attr("value", value + (1/channelConunt*100));
                console.log(value, 1/channelConunt*100);
            }
        }
        $.when.apply($, defs).done(function () {
            parseFeedLinks(channelLinks);
            //Hide progress bar upon fetch done
            $("#sub-exporter-progressbar-container").toggleClass("hidden");
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