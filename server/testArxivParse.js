const { searchArxiv } = require('./arxivService'); // Assuming arxivService.js is in the same directory

async function runTest() {
    console.log("Testing arXiv Service...");
    try {
        // Use a query that you know should return results from arXiv
        const results = await searchArxiv("cat:cs.AI AND ti:transformer", { totalLimit: 5, perPage: 5 });
        // Or a general query:
        // const results = await searchArxiv("graphene quantum", { totalLimit: 3, perPage: 3 });

        if (results && results.length > 0) {
            console.log(`Successfully fetched ${results.length} results from arXiv.`);
            console.log("First result (MCP format):");
            console.log(JSON.stringify(results[0], null, 2)); // Print the first result to check MCP structure

            // You can add more checks here, e.g., verify all essential MCP fields are present
            results.forEach((item, index) => {
                console.log(`--- Item ${index + 1} ---`);
                if (!item.source || item.source !== "arXiv") console.error("Missing or incorrect source!");
                if (!item.title) console.error("Missing title!");
                if (!item.url) console.error("Missing URL!");
                if (!item.abstract) console.error("Missing abstract!");
                // Add more checks as needed
            });

        } else {
            console.log("No results returned from arXiv or an empty array.");
        }
    } catch (error) {
        console.error("Error during arXiv service test:", error);
    }
}

runTest();