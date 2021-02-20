const 
	NetlifyAPI = require('netlify'),
	publicIp = require('public-ip'),
	yargs = require('yargs'),
	fs = require('fs');

// Get args from CLI.
const argv = yargs
	.option('token', {
		description: 'Token from "User settings" > "Applications" > "New access token"',
		alias: 't',
		type: 'string'
	})
	.option('hostname', {
		description: 'DNS name to update',
		alias: 'h',
		type: 'string'
	})
	.option('type', {
		description: '"A" (IPv4) || "AAAA" (IPv6)',
		alias: 'a',
		type: 'string'
	})
	.argv;

// Write logs.txt
const writeLog = (success, message) => {
	let content = `${(success) ? "[OK]" : "[ERROR]"} ${message}`;
	fs.appendFile(`${__dirname}/console.log`, `${content}\n`, function (err) {
		if (err) throw err;
		console.log(content);
	});
}

// Initalize client from `token` argument.
const client = (argv.token) ? new NetlifyAPI(argv.token) : "";

/**
 * Fetch every zones from `argv.token`
 */
const getZones = async () => {
	try {
		return await client.getDnsZones({})
	} 
	catch (e) {
		writeLog(false, e);
	}
}

/**
 * Fetch every records from `zoneId`
 * @param {String} zoneId - Zone ID
 */
const getRecords = async (zoneId) => {
	try {
		return await client.getDnsRecords({
			zoneId
		});
	}
	catch (e) {
		writeLog(false, e);
	}
}

/**
 * Update record from its ID and its ZoneID.
 * Delete then create new one.
 * @param {String} zoneId - Zone ID
 * @param {String} dnsRecordId - Record ID from Zone ID
 * @param {String} ip - New IP
 */
const updateRecord = async (zoneId, dnsRecordId, ip) => {
	writeLog(true, "Found a matching record ! Updating it...")

	try {
		// Delete DNS record
		await client.deleteDnsRecord({
			zoneId, dnsRecordId
		})
		.then (async () => {
			writeLog(true, `Current record successfully deleted ! Creating a new record...`);

			// Create new DNS Record with type from args.
			await client.createDnsRecord({
				zoneId,
				body: {
					type: argv.type,
					hostname: argv.hostname,
					value: ip
				}
			})
			.then (() => 
				writeLog(true, `IP Updated successfully ! Exiting...`)
			)
			.catch (e =>
				writeLog(false, `Failed to create new record\n${e}`)
			);
		})
		.catch (e => 
			writeLog(false, `Failed to delete current record\n${e}`)
		);
	}
	catch (e) {
		writeLog(false, e);
	}
};

/**
 * Update IP with your IP `ip`
 * @param {String} newIp - IP (v4 || v6)
 */
const updateIP = async (newIp) => {

	// Fetching zones, from `token`
	getZones().then(zones => {
		writeLog(true, `${zones.length} zones fetched !`);

		// For each zones fetched: fetch their records...
		zones.forEach (zone => {

			// Fetching records from `zone.id`.
			getRecords(zone.id).then(records => {
				writeLog(true, `Records (from zone ${zone.id}) fetched !`)
				writeLog(true, `If the script exits here, then no records matches with hostname argument.`);

				// For each records fetched: check if `record.hostname`
				// is matching with `argv.hostname`.
				records.forEach (record => {
					if (record.hostname == argv.hostname) {
						// Update IP if record value is not the same.
						if (record.value != newIp) {
							updateRecord(zone.id, record.id, newIp);
						}
						else {
							writeLog(true, `Same IP ([Record] ${record.value} - [Current IP] ${newIp}) ! Exiting...`);
						}
					}
				})
			})
			.catch (e => {
				writeLog(false, e);
			});
		});
	})
	.catch (e => {
		writeLog(false, e);
	});
}

// Start script...
// Check if type is A (IPv4) or AAAA (IPv6)
const start = async () => {
	if (argv.type === "A")
		await publicIp.v4()
		.then (ip => updateIP(ip))
	else if (argv.type === "AAAA")
		await publicIp.v6()
		.then (ip => updateIP(ip));
}

// Check if arguments is missing...
if (!argv.token || !argv.hostname || !argv.type) {
	writeLog(false, 'Args: --hostname || --type || --token is missing ! Exiting...');
}
else {
	writeLog(true, `[${new Date()}] Started update process.\nHostname (to update): ${argv.hostname}\nType: ${argv.type}\nToken: ${argv.token.substr(0, 8)}...`);

	// Start !
	start();
}
