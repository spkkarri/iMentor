// testCore.js
const { searchCore } = require('./coreService'); // Assuming coreService.js is in the same directory

async function runCoreTest() {
    console.log("Testing CORE Service...");
    try {
        // Use a common search term that should yield results from CORE
        const query = "machine learning applications";
        const options = {
            totalLimit: 3, // Let's try to get up to 3 results
            perPage: 3     // Fetch 3 per API call (since totalLimit is small)
        };

        console.log(`Searching CORE for: "${query}" with options:`, options);
        const results = await searchCore(query, options);

        if (results && results.length > 0) {
            console.log(`Successfully fetched ${results.length} results from CORE.`);
            console.log("First result (MCP format):");
            console.log(JSON.stringify(results[0], null, 2)); // Print the first result

            console.log("\nVerifying MCP structure for all CORE results...");
            results.forEach((item, index) => {
                console.log(`--- CORE Item ${index + 1} ---`);
                if (!item.source || item.source !== "CORE") console.error(`Item ${index + 1}: Missing or incorrect source! Expected "CORE", got "${item.source}"`);
                if (typeof item.title !== 'string' || item.title.trim() === "") console.error(`Item ${index + 1}: Missing or empty title!`);
                if (!item.url && !item.alternate_urls.find(u => u.type === 'pdf')) console.error(`Item ${index + 1}: Missing a primary URL or a PDF URL!`); // Check for either a main URL or at least a PDF
                if (typeof item.abstract !== 'string') console.error(`Item ${index + 1}: Abstract is not a string (could be null if truly missing, but should exist as a key)!`);
                if (!Array.isArray(item.authors)) console.error(`Item ${index + 1}: Authors field is not an array!`);
                if (!item.publicationYear) console.error(`Item ${index + 1}: Missing publicationYear!`);
                // Add more specific checks as needed based on your MCP definition
            });
            console.log("MCP structure verification complete for CORE results.");

        } else if (results && results.length === 0) {
            console.log("CORE service returned 0 results for the query.");
        } else {
            console.log("CORE service did not return a valid results array.");
        }
    } catch (error) {
        console.error("Error during CORE service test:", error);
    }
}

runCoreTest();