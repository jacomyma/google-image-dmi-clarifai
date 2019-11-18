var s = {} // Settings

/// EDIT SETTINGS BELOW
s.apiKey = '%%APIKEY%%'
s.threshold_demographics = 0.5 // range [0, 1] - Applies to the DEMOGRAPHICS API
s.threshold_general = 0.9 // range [0, 1] - Applies to the GENERAL API
/// END OF SETTINGS


/// MACHINERY

// Download the CSV from the DMI tool at https://tools.digitalmethods.net/beta/googleImages/
var app
artoo.scrapeTable('table', {
  headers: 'th',
  done: function(table){

		// Load CLARIFAI
		console.log("Loading Clarifai API...")
		artoo.injectScript('https://sdk.clarifai.com/js/clarifai-latest.js', function() {
			// Connect to the API via API key
			app = new Clarifai.App({
				apiKey: s.apiKey
			})
			console.log('...API loaded')

			var urls = table.map(function(d){return d['thumbnail url']})
				// .filter(function(d,i){return i<10})

			if (urls.length>100) {
				alert("/!\\ You cannot query more than 100 URLS at once; please use different s. The process has been stopped.")
				return
			}

			// Query DEMOGRAPHICS API
			console.log('Querying Clarifai "Demographics" API to enrich data...')
			app.models.predict(
		    'c0c0ac362b03416da06ab3fa36fb58e3', // Demographics API
		    urls)
		  .then(function(response){
		  	console.log('...Clarifai responded.')
		  	if (!response.outputs || response.outputs.length == 0) {
		  		console.error("Clarifai response has no outputs")
		  	} else {
			    console.log('Response has ' + response.outputs.length + ' outputs')

			    // Enrich the CSV with the response.
			    table.forEach(function(row, i){
			    	if (!response.outputs[i] || !response.outputs[i].data) {
			    		console.log('  - Output ' + i + ' has no data')
			    	} else {
				    	var data = response.outputs[i].data
				    	if (data && data.regions) {
				    		data.regions.forEach(function(region){
				    			var face = region.data.face
				    			if (face && face.gender_appearance) {
				    				face.gender_appearance.concepts.forEach(function(concept){
				    					if (concept.value >= s.threshold_demographics) {
				    						row[concept.name] = (row[concept.name] || 0) + 1
				    					}
				    				})
				    			}
				    			if (face && face.multicultural_appearance) {
				    				face.multicultural_appearance.concepts.forEach(function(concept){
				    					if (concept.value >= s.threshold_demographics) {
				    						row[concept.name] = (row[concept.name] || 0) + 1
				    					}
				    				})
				    			}
				    		})
				    	}
			    	}
			    })
			    
			    // Query GENERAL API
					console.log('Querying Clarifai "General" API to enrich data...')
					app.models.predict(
				    'aaa03c23b3724a16a56b629203edc62c', // General API
				    urls)
				  .then(function(response){
				  	console.log('...Clarifai responded.')
				  	if (!response.outputs || response.outputs.length == 0) {
				  		console.error("Clarifai response has no outputs")
				  	} else {
					    console.log('Response has ' + response.outputs.length + ' outputs')

					    // Enrich the CSV with the response.
					    table.forEach(function(row, i){
					    	if (!response.outputs[i] || !response.outputs[i].data) {
					    		console.log('  - Output ' + i + ' has no data')
					    	} else {
						    	var data = response.outputs[i].data
					    		// console.log(' - Output data', data)
						    	if (data && data.concepts) {
						    		row["general concepts"] = data.concepts
						    			.filter(function(c){return c.value >= s.threshold_general})
						    			.map(function(c){return c.name})
						    			.join(", ")
						    	}
					    	}
					    })
					    
					  	// Save the CSV
					  	console.log("Download CSV")
					  	artoo.saveCsv(table)
				  	}

				  })
				  .catch(function(error){
				  	console.log('Something went wrong with the GENERAL api call')
				  	alert('Something went wrong with the GENERAL api call (see console for details)')
				    console.log('Error status code: ' + error.data['status']['code']);
				    console.log('Error description: ' + error.data['status']['description']);
				    if (error.data['status']['details'])
				    {
				      console.log('Error details: ' + error.data['status']['details']);
				    }
				  })
		  	}

		  })
		  .catch(function(error){
		  	console.log('Something went wrong with the DEMOGRAPHICS api call')
		  	alert('Something went wrong with the DEMOGRAPHICS api call (see console for details)')
		    console.log('Error status code: ' + error.data['status']['code']);
		    console.log('Error description: ' + error.data['status']['description']);
		    if (error.data['status']['details'])
		    {
		      console.log('Error details: ' + error.data['status']['details']);
		    }
		  })
		})
  }
})
