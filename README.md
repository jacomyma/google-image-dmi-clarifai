# google-image-dmi-clarifai
A tool to tag Google image queries with Clarifai

## How to use
The tool is basically a web page. Serve it somewhere and you can use it.

## How to change the script
This tool has no integrated way to change the script, but you can reproduce my manual process.

The template for the script is the file ```script_template.js```. This file in itself is not used by the tool. Note that it contains a proxy (```%%APIKEY%%```) for the API key that the user must fill in the interface. The script in the interface will ultimately replace this by the right key.

The script of the bookmarklet is generated manually by copy-pasting the content of ```script_template.js``` into the <a href="https://medialab.github.io/artoo/generator/">bookmarklet generator</a> of Artoo. The resulting script is then stored in the repository as ```script_template_artoo.js```. This file is the one actually used by the web interface to build the bookmarklet.

## Thanks
To @Yomguithereal for his work on <a href="https://medialab.github.io/artoo/">Artoo</a> !