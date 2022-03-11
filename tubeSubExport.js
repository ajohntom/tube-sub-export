    //Registering on the DOM done an IIFE
    $(function () {
		//Because it takes time to load content via scripts
		setTimeout(()=>{
			buildUI();
		}, 1000);
    });

	function buildUI(){
		var primaryContainer = $("#primary");
		var instructionContainer = $('<div/>', {
            id: 'sub-exporter-container',
            "class": "style-scope",
        }).prependTo(primaryContainer);
		var instructionTextContainer = $('<div/>', {
            id: 'sub-instruction',
            "class": "style-scope"
        }).prependTo(instructionContainer);
		var instructionText = $('<span/>', {
            id: 'sub-instruction-text',
            "class": "style-scope",
        }).prependTo(instructionTextContainer);
		instructionText.html("Upon clicking Download button, extension will try to automatically scroll down to load every subscription. If the XML does not contain your subscriptions correctly, please scroll down, until every subscription is loaded!");
		var logText = $('<span/>', {
            id: 'sub-log-text',
            "class": "style-scope",
        }).prependTo(instructionTextContainer);

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
        button.click(() => {
			clearLog();
            getSubsXML();
        });
        var progressBarContainer = $('<div/>', {
            id: 'sub-exporter-progressbar-container',
            "class": "style-scope hidden",
        }).prependTo(container);
        var progressBarLabel = $('<label/>',{
            id: 'sub-exporter-progressbar-label',
            "for": 'sub-exporter-progressbar'
        }).prependTo(progressBarContainer);
        progressBarLabel.html("Progress:")
        var progressBar = $('<progress/>', {
            id: 'sub-exporter-progressbar',
            "class": "style-scope",
            min: 0,
            max: 100,
            value: 0
        }).prependTo(progressBarContainer);
		//Clear log, to make sure...
		clearLog();
		//Dark mode handling (text colors can vary...)
		if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
			$(progressBarLabel).css("color", "#ffffff");
		}
		window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
			var newColorScheme = event.matches ? "dark" : "light";
			switch(newColorScheme){
				case "dark":
					$(progressBarLabel).css("color", "#ffffff");
					break;
				case "light":
					$(progressBarLabel).css("color", "#000");
					break;
			}
		});
	}

	function getAllSubs(){
		return new Promise((resolve, reject)=>{
			var prevHeight = 0;
			var isFinished = false;
			var cI = setInterval(() => {
				if(!isFinished){
					$(window).scrollTop(prevHeight + $("#primary").height());
					setTimeout(()=>{
						prevHeight = $("#primary").height();
						if($("#primary").height() <= prevHeight){
							isFinished = true;
							$(window).scrollTop(0);
							resolve("Done");
						}
					},200)
				}
				else{
					clearInterval(cI);
				}
			},250);
		});
		
	}

    //Get sub names and direct links
    async function getSubsXML() {
	try{
		await getAllSubs();
        //Reset meter
        $("#sub-exporter-progressbar").attr("value", 0);
        //Show progress bar upon fetch start
        $("#sub-exporter-progressbar-container").toggleClass("hidden");
        //Get the subscriptions
        var ytSubsRow = $("ytd-channel-renderer");
        var channelInfos = [];
        var channelLinks = {};
        var promiseArray = [];
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
		try{
        for (var key in channelLinks) {
            if (!(/\/channel\//i.test(channelLinks[key]))) {
				promiseArray.push($.ajax({
                    url: channelLinks[key],
                    context: {
                        channelName: key,
                        channelLinks: channelLinks,
                        channelConunt: channelConunt,
                    },
                    success: function (data) {
                        var html = $.parseHTML(data);
						var canonicalFound = false;
                        for (var i = 0; i < html.length; i++) {
                            if (html[i].rel == "canonical") {
                                this.channelLinks[this.channelName] = html[i].href;
                                var value = parseFloat($("#sub-exporter-progressbar").attr("value"));
                                $("#sub-exporter-progressbar").attr("value", value + (1/this.channelConunt*100));
								canonicalFound = true;
								break;
                            }
                        }
						if(!canonicalFound){
							this.channelLinks[this.channelName] = undefined;
							var value = parseFloat($("#sub-exporter-progressbar").attr("value"));
							$("#sub-exporter-progressbar").attr("value", value + (1/this.channelConunt*100));
							addLogLine(`ERROR: Channel link fetching failed! Channel name: ${this.channelName}. Will be excluded from XML!`);
						}
						
                    },
					error: function (xhr, err){
						console.error(err);
					}
                }));
            }
            else{
                var value = parseFloat($("#sub-exporter-progressbar").attr("value"));
                $("#sub-exporter-progressbar").attr("value", value + (1/channelConunt*100));
            }
        }
		}
		catch(err){
			console.error(err);
		}

		//Check if all fetched
        Promise.all(promiseArray)
		.then(() => {
            parseFeedLinks(channelLinks);
            //Hide progress bar upon fetch done
            $("#sub-exporter-progressbar-container").toggleClass("hidden");
        })
		.catch((err)=>{
			console.error(err);
			//Handle error
			addLogLine(`ERROR: During channel link fetching process! XML can not be generated!`);
			//Hide progress bar upon fetch done
            $("#sub-exporter-progressbar-container").toggleClass("hidden");
		});
	}
	catch(err)
	{
		console.error(err);
	}
    }

    //Modifies channel URLs to point to their feed
    function parseFeedLinks(channelLinks) {
        var xmlUrl = "https://www.youtube.com/feeds/videos.xml?channel_id=";
		//Bad links contain an array of links, where canonical link is not available
		var badLinks = [];
        for (var key in channelLinks) {
			if(channelLinks[key] == undefined){
				delete channelLinks[key];
			}
			else{
				var channelId = channelLinks[key].split("/").pop();
				channelLinks[key] = xmlUrl + channelId;
			}
        }
        assembleXML(channelLinks);
    }

    function assembleXML(channelLinks) {
        var XML = [];
        var pre = '<opml version="1.1">\n<body><outline text="YouTube - subscriptions" title="YouTube - subscriptions">';
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

	function addLogLine(lineContent){
		
		var logLine = $('<div/>', {
            id: 'sub-log-text-line',
            "class": "style-scope",
        }).appendTo($("#sub-log-text"));
		logLine.html(new Date().toLocaleString() + " - " + lineContent);
	}

	function clearLog(){
		$("#sub-log-text").html("");
	}