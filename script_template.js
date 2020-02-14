var settings = {}

/// YOU CAN EDIT SETTINGS BELOW
settings.apiKey = '%%APIKEY%%'
settings.routes = '%%ROUTES%%'
/// END OF SETTINGS


/// MACHINERY

// Unstringify routes
settings.routes = JSON.parse(settings.routes)
console.log('...Selected models:', settings.routes)

// UI
var ui
try {
	ui = new artoo.ui();
	ui.$().append('<style>.container{position:fixed;top:0;left:0;padding:0:margin:0;width:100%;height:100%;background:rgba(255,255,255,0.9);} .inner{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);}</style><div class="container"><div class="inner"><strong>PLEASE WAIT...</strong></div></div>');
} catch(e) { console.warn('Note: minor Artoo UI issue', e)}
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
					// .filter(function(d,i){return i<10}) // TODO: DISABLE ME
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
				try {
					ui.kill()
				} catch(e) { console.warn('Note: minor Artoo UI issue', e)}
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
					var concepts = {}
					var scanConcepts = function(dataConcepts) {
						dataConcepts
		    			.filter(function(c){return c.value >= type.threshold})
		    			.forEach(function(c){
		    				concepts[c.name] = (concepts[c.name] || 0) + 1
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
					for(c in concepts){
						row[c] = concepts[c]
					}
					break;
			}
  	}
  	queue.updateRow(url, row)
  })
}

// Error message
function notifyError(error, msg){
	try {
		ui.kill()
	} catch(e) { console.warn('Note: minor Artoo UI issue', e)}
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