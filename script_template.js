var settings = {}

/// YOU CAN EDIT SETTINGS BELOW
settings.apiKey = '%%APIKEY%%'
settings.routes = [
	{
		name: 'GENERAL',
		api: 'aaa03c23b3724a16a56b629203edc62c',
		types: [
			{
				id: 'list-in-a-column',
				threshold: 0.9
			}
		]
	}, {
		name: 'DEMOGRAPHICS',
		api: 'c0c0ac362b03416da06ab3fa36fb58e3',
		types: [
			{
				id: 'json-in-a-column'
			},{
				id: 'count-in-multiple-columns',
				threshold: 0.5
			}
		]
	}
]
/// END OF SETTINGS


/// MACHINERY

// UI
var ui = new artoo.ui();
ui.$().append('<style>.container{position:fixed;top:0;left:0;padding:0:margin:0;width:100%;height:100%;background:rgba(255,255,255,0.9);} .inner{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);}</style><div class="container"><div class="inner"><strong>PLEASE WAIT...</strong></div></div>');
// Download the CSV from the DMI tool at https://tools.digitalmethods.net/beta/googleImages/
var app, queue
artoo.scrapeTable('table', {
  headers: 'th',
  done: function(table){

		// Load CLARIFAI
		console.log("Loading Clarifai API...")
		artoo.injectScript('https://sdk.clarifai.com/js/clarifai-latest.js', function() {
			// Connect to the API via API key
			app = new Clarifai.App({
				apiKey: settings.apiKey
			})
			console.log('...API loaded')

			queue = newQueue(
				table,
				table.map(function(d){return d['thumbnail url']})
					//.filter(function(d,i){return i<10}) // TODO: DISABLE ME
			)
			queue.nextBatch()
		})
  }
})

function newQueue(table, urls) {
	var batchSize = 100
	var tableIndex = {}
	table.forEach(function(row,i){
		tableIndex[row['thumbnail url']] = row
	})
	return {
		urls: urls || [],
		tableIndex: tableIndex,
		nextBatch: function() {
			if (this.urls.length == 0) {
				// Save the CSV
		  	console.log("Download CSV")
		  	artoo.saveCsv(Object.values(this.tableIndex))
				ui.kill()
				alert('Clarifai queries successful')
			} else {
				var i = batchSize
				var batch = []
				while(i-->0 && this.urls.length>0) {
					batch.push(this.urls.pop())
				}
				try {
					runClarifaiBatch(batch)
				} catch(e) {
					notifyError(e, "Error while running Clarifai batch :(")
				}
			}
		},
		updateRow: function(url, o) {
			var k,v
			for (k in o) {
				this.tableIndex[url][k] = o[k]
			}
		}
	}
}

function runClarifaiBatch(urls, r) {
	if (r===undefined) { r = 0 }
	if (r >= settings.routes.length) {
		// All routes done
		queue.nextBatch()
	} else {
		var route = settings.routes[r]
		console.log('Querying Clarifai "'+route.name+'" API to enrich data...')
		var call = app.models.predict(route.api,urls)
		  .then(function(response){
		  	console.log('...Clarifai responded...')
		  	if (!response.outputs || response.outputs.length == 0) {
		  		notifyError(undefined, "Clarifai response has no outputs")
		  	} else {
			    console.log('   (response has ' + response.outputs.length + ' outputs)...')
			  	route.types.forEach(function(type){
			  		parseResponse(response, type, route.name, urls)
			  	})
			  	runClarifaiBatch(urls, r+1)
			  }
		  })
		  .catch(function(error){
		  	notifyError(error, 'ARG, Something went wrong with the '+route.name+' api call')
		  })
	}
	return

	// TODO: remove below
	// Query DEMOGRAPHICS API
	console.log('Querying Clarifai "Demographics" API to enrich data...')
	app.models.predict(
    'c0c0ac362b03416da06ab3fa36fb58e3', // Demographics API
    urls)
  .then(function(response){
  	console.log('...Clarifai responded.')
  	if (!response.outputs || response.outputs.length == 0) {
  		notifyError(undefined, "Clarifai response has no outputs")
  	} else {
	    console.log('Response has ' + response.outputs.length + ' outputs')

	    // Enrich the CSV with the response.
	    urls.forEach(function(url, i){
	    	var row={}
	    	if (!response.outputs[i] || !response.outputs[i].data) {
	    		// console.log('  - Output ' + i + ' has no data')
	    	} else {
		    	var data = response.outputs[i].data
		    	if (data && data.regions) {
		    		data.regions.forEach(function(region){
		    			var face = region.data.face
		    			if (face && face.gender_appearance) {
		    				face.gender_appearance.concepts.forEach(function(concept){
		    					if (concept.value >= settings.threshold_demographics) {
		    						row[concept.name] = (row[concept.name] || 0) + 1
		    					}
		    				})
		    			}
		    			if (face && face.multicultural_appearance) {
		    				face.multicultural_appearance.concepts.forEach(function(concept){
		    					if (concept.value >= settings.threshold_demographics) {
		    						row[concept.name] = (row[concept.name] || 0) + 1
		    					}
		    				})
		    			}
		    		})
		    	}
	    	}
	    	queue.updateRow(url, row)
	    })
	    
	    // Query GENERAL API
			console.log('Querying Clarifai "General" API to enrich data...')
			app.models.predict(
		    'aaa03c23b3724a16a56b629203edc62c', // General API
		    urls)
		  .then(function(response){
		  	console.log('...Clarifai responded.')
		  	if (!response.outputs || response.outputs.length == 0) {
		  		notifyError(undefined, "Clarifai response has no outputs")
		  	} else {
			    console.log('Response has ' + response.outputs.length + ' outputs')

			    // Enrich the CSV with the response.
			    urls.forEach(function(url, i){
			    	var row = {}
			    	if (!response.outputs[i] || !response.outputs[i].data) {
			    		// console.log('  - Output ' + i + ' has no data')
			    	} else {
				    	var data = response.outputs[i].data
			    		// console.log(' - Output data', data)
				    	if (data && data.concepts) {
				    		row["general concepts"] = data.concepts
				    			.filter(function(c){return c.value >= settings.threshold_general})
				    			.map(function(c){return c.name})
				    			.join(", ")
				    	}
			    	}
			    	queue.updateRow(url, row)
			    })
			    
			  	queue.nextBatch()
		  	}

		  })
		  .catch(function(error){
		  	notifyError(error, 'Something went wrong with the GENERAL api call')
		  })
  	}

  })
  .catch(function(error){
  	notifyError(error, 'Something went wrong with the DEMOGRAPHICS api call')
  })
}

function parseResponse(response, type, routeName, urls) {
	console.log('...'+routeName+': Parse response as '+type.id+'...')
	// Enrich the CSV with the response.
  urls.forEach(function(url, i){
  	var row = {}
  	if (!response.outputs[i] || !response.outputs[i].data) {
  		// console.log('  - Output ' + i + ' has no data')
  	} else {
    	var data = response.outputs[i].data
  		// console.log(' - Output data', data)
  		switch (type.id) {
				
				case 'json-in-a-column':
					row[routeName+'-json'] = JSON.stringify(data)
					break;

				case 'list-in-a-column':
					var concepts = {}
					var scanConcepts = function(dataConcepts) {
						dataConcepts
		    			.filter(function(c){return c.value >= type.threshold})
		    			.forEach(function(c){
		    				concepts[c.name] = true
		    			})
					}
					if (data && data.concepts) {
		    		scanConcepts(data.concepts)
		    	}
		    	if (data && data.regions) {
		    		data.regions.forEach(function(region){
		    			if (region.data && region.data.concepts) {
				    		scanConcepts(region.data.concepts)
				    	}
		    		})
		    	}
					row[routeName+'-concepts'] = Object.keys(concepts).join(", ")
					break;
				
				case 'count-in-multiple-columns':
					// TODO
					break;
			}
  	}
  	queue.updateRow(url, row)
  })
}

// Error message
function notifyError(error, msg){
	ui.kill()
	console.log(msg)
	if (error) {
		console.error(error)
		if(error.data) {
		  console.log('Error status code: ' + error.data['status']['code']);
		  console.log('Error description: ' + error.data['status']['description']);
		  if (error.data['status']['details'])
		  {
		    console.log('Error details: ' + error.data['status']['details']);
		  }
		}
	}
	alert(msg + ' (see JS console for more details)')
}