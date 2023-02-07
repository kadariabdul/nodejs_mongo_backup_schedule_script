const cron = require('node-cron');
const moment = require("moment");
const fsExtra = require("fs-extra");
const { exec } = require("child_process");
const config = {
    database : {
        host : 'localhost',
        port : 27017,
        name : 'graphql-demo',
    }
}

// Backup a database at 11:59 PM every day.
cron.schedule('23 59 * * *', function() {
    console.log('---------------------START---------------------');
    console.log(`Started Cron Job At ${moment().format("YYYY-MM-DD hh:mm:ss A")}`);
    const backupName = `${moment().format("YYYY-MM-DDTHH:mm:ss")}`;
	const backupFolder = `./backup/${backupName}`
    new Promise(async (resolve, reject) => {

        // sync backup folder
        if (!fsExtra.existsSync('./backup/')) {
            fsExtra.mkdirSync('./backup/');
        }

        // code to remove old backup (except latest 3)
        const files = await fsExtra.readdirSync('./backup/');
        if (files.length > 2) {
            const mapFiles = files.map((m)=>{
                return m.split(".tgz")[0]
            });
            for (const date of mapFiles) {
            if (moment(date).isBefore(moment().subtract(2,'minutes').format("YYYY-MM-DDTHH:mm:ss"))){
                    if (fsExtra.existsSync(`./backup/${date}.tgz`)) {
                        fsExtra.removeSync(`./backup/${date}.tgz`);
                    }
                }
            }
        }

        // code to get latest zip and store in .tgz file
        try {
            exec(`mongodump --host ${config.database.host} --port ${config.database.port} --db ${config.database.name} --gzip`, (error, stdout, stderr) => {
                if (error !== null) {
                    reject(error);
                } else {
                    exec(`mv dump ${backupFolder}`, (error, stdout, stderr) => {
                        if (error !== null) {
                            reject(error);
                        } else {
                            exec(`find ${backupFolder} -printf "%P\n" | tar -czf ${backupFolder}.tgz --no-recursion -C ${backupFolder} -T -`, (error, stdout, stderr) => {
                                if (error !== null) {
                                    reject(error);
                                } else {
                                    exec(`rm -rf ${backupFolder}`, (error, stdout, stderr) => {
                                        if (error !== null) {
                                            reject(error);
                                        } else {
                                            resolve({
                                                data: fsExtra.readFileSync(`${backupFolder}.tgz`),
												backupName:backupName
                                            });
                                        }
                                    });
                                }
                            });
                        }
                    });
                }
            });
        } catch (error) {
            console.log(error);
        }
        console.log('Database backup complete');
        console.log(`Ended Cron Job At ${moment().format("YYYY-MM-DD hh:mm:ss A")}`);
        console.log('----------------------END----------------------');
    });
});
