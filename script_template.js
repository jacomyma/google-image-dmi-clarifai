var settings = {}

/// YOU CAN EDIT SETTINGS BELOW
settings.apiKey = '%%APIKEY%%'
settings.threshold_demographics = 0.5 // range [0, 1] - Applies to the DEMOGRAPHICS API
settings.threshold_general = 0.9 // range [0, 1] - Applies to the GENERAL API
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
				ui.kill()
				alert('Clarifai queries successful')
			} else {
				var i = batchSize
				var batch = []
				while(i-->0 && this.urls.length>0) {
					batch.push(this.urls.pop())
				}
				runClarifaiBatch(batch)
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

function runClarifaiBatch(urls) {
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

// Error message
function notifyError(error, msg){
	ui.kill()
	console.log(msg)
	alert(msg + ' (see JS console for more details)')
	if (error) {
	  console.log('Error status code: ' + error.data['status']['code']);
	  console.log('Error description: ' + error.data['status']['description']);
	  if (error.data['status']['details'])
	  {
	    console.log('Error details: ' + error.data['status']['details']);
	  }
	}
}