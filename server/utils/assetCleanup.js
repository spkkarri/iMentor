const fs = require('fs').promises; // Use fs.promises for async operations
const path = require('path');

// Define constants relative to this file's location (server/utils)
const ASSETS_DIR = path.join(__dirname, '..', 'assets'); // Go up one level to server/assets
const BACKUP_DIR = path.join(__dirname, '..', 'backup_assets'); // Go up one level to server/backup_assets
const FOLDER_TYPES = ['docs', 'images', 'code', 'others']; // Folders within each user's asset dir

/**
 * Ensures asset directories exist without moving existing files
 * This is a safer version that doesn't automatically backup files on startup
 */
async function performAssetCleanup() {
    console.log("\n--- Starting Asset Cleanup ---");
    try {
        // Ensure backup base directory exists
        await fs.mkdir(BACKUP_DIR, { recursive: true });

        // List potential user directories in assets
        let userDirs = [];
        try {
            userDirs = await fs.readdir(ASSETS_DIR);
        } catch (err) {
            if (err.code === 'ENOENT') {
                console.log("Assets directory doesn't exist yet, creating it.");
                await fs.mkdir(ASSETS_DIR, { recursive: true }); // Ensure assets dir exists
                console.log("--- Finished Asset Cleanup (Created assets directory) ---");
                return; // Nothing to clean up
            }
            throw err; // Re-throw other errors accessing assets dir
        }

        if (userDirs.length === 0) {
             console.log("Assets directory is empty. Creating structure.");
             console.log("--- Finished Asset Cleanup (No user assets found) ---");
             return;
        }

        for (const userName of userDirs) {
            const userAssetPath = path.join(ASSETS_DIR, userName);

            try {
                // Check if the item in assets is actually a directory
                const stats = await fs.stat(userAssetPath);
                if (!stats.isDirectory()) {
                    console.log(`  Skipping non-directory item in assets: ${userName}`);
                    continue;
                }

                console.log(`  Processing assets for user: [${userName}]`);

                // Process each defined folder type (docs, images, etc.)
                for (const type of FOLDER_TYPES) {
                    const sourceTypePath = path.join(userAssetPath, type);
                    
                    // Always ensure the type directory exists in the main assets folder
                    try {
                        await fs.mkdir(sourceTypePath, { recursive: true });
                    } catch (mkdirErr) {
                         console.error(`    Failed to create directory ${sourceTypePath}:`, mkdirErr.message);
                    }
                } // End loop through FOLDER_TYPES

                console.log(`  Ensured directory structure for user [${userName}]`);

            } catch (userDirStatErr) {
                 // Error checking if the item in assets is a directory
                 console.error(`Error processing potential user asset directory ${userAssetPath}:`, userDirStatErr.message);
            }
        } // End loop through userDirs

        console.log("--- Finished Asset Cleanup ---");

    } catch (error) {
        // Catch errors related to backup dir creation or reading the main assets dir
        console.error("!!! Critical Error during Asset Cleanup process:", error);
    }
}

/**
 * Backs up all asset types for a single user.
 * @param {string} userName - The name of the user.
 * @param {string} timestamp - The backup timestamp.
 */
async function backupUserAssets(userName, timestamp) {
    const userAssetPath = path.join(ASSETS_DIR, userName);
    const userBackupPath = path.join(BACKUP_DIR, userName, `backup_${timestamp}`);
    let somethingMoved = false;

    try {
        const stats = await fs.stat(userAssetPath);
        if (!stats.isDirectory()) {
            console.log(`  Skipping non-directory item: ${userName}`);
            return;
        }

        console.log(`  Processing user: [${userName}]`);
        await fs.mkdir(userBackupPath, { recursive: true });

        for (const type of FOLDER_TYPES) {
            const moved = await moveAssetType(userAssetPath, userBackupPath, type);
            if (moved) somethingMoved = true;
        }

        if (somethingMoved) {
            console.log(`  Backup complete for [${userName}] to backup_${timestamp}`);
        } else {
            console.log(`  No assets found to backup for [${userName}]`);
        }
    } catch (error) {
        console.error(`Error backing up assets for ${userName}:`, error.message);
    }
}

/**
 * Moves a single asset type folder to the backup location.
 * @param {string} userAssetPath - The user's main asset path.
 * @param {string} userBackupPath - The path for the timestamped backup.
 * @param {string} type - The asset type (e.g., 'docs').
 * @returns {Promise<boolean>} - True if a folder was moved.
 */
async function moveAssetType(userAssetPath, userBackupPath, type) {
    const sourceTypePath = path.join(userAssetPath, type);
    const backupTypePath = path.join(userBackupPath, type);
    let moved = false;

    try {
        await fs.access(sourceTypePath); // Check if source exists
        await fs.rename(sourceTypePath, backupTypePath);
        moved = true;
    } catch (err) {
        if (err.code !== 'ENOENT') { // Ignore if source doesn't exist
            console.error(`    Error moving ${sourceTypePath}:`, err.message);
        }
    } finally {
        // Always ensure the original directory structure is present
        await fs.mkdir(sourceTypePath, { recursive: true });
    }
    return moved;
}

/**
 * Manual backup function - only runs when explicitly called
 * This is the old aggressive cleanup logic, now refactored.
 */
async function performManualBackup() {
    console.log("\n--- Starting Manual Asset Backup ---");
    try {
        await fs.mkdir(BACKUP_DIR, { recursive: true });
        const userDirs = await fs.readdir(ASSETS_DIR).catch(err => {
            if (err.code === 'ENOENT') return [];
            throw err;
        });

        if (userDirs.length === 0) {
            console.log("Assets directory is empty. No backup needed.");
            return;
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        console.log(`Starting backup with timestamp: ${timestamp}`);

        for (const userName of userDirs) {
            await backupUserAssets(userName, timestamp);
        }

    } catch (error) {
        console.error("!!! Critical Error during Manual Asset Backup:", error);
    } finally {
        console.log("--- Finished Manual Asset Backup ---");
    }
}

// Export the functions to be used elsewhere
module.exports = { performAssetCleanup, performManualBackup };
