const core = require("@actions/core");
const github = require("@actions/github");
const fs = require("fs");
const { XMLParser } = require('fast-xml-parser');
const compareVersions = require('compare-versions');

const token = process.argv[2];
const octokit = github.getOctokit(token);

const messageToClose = `
Sorry, but according to the version you specify in this issue, \
you are using the [Telegram for macOS](https://macos.telegram.org), \
not the [Telegram Desktop](https://desktop.telegram.org).
You can report your issue to [the group](https://t.me/macswift) \
or to [the repository of Telegram for macOS]\
(https://github.com/overtake/TelegramSwift).

**If I made a mistake and closed your issue wrongly, please reopen it. \
Thanks!**
`;

let messageCantDecide = `Seems like it's neither the Telegram Desktop \
nor the Telegram for macOS version.`;

const processIssue = async (macosVersion) => {

	let repository = {
		owner: github.context.issue.owner,
		repo: github.context.issue.repo,
	};

	let tags = await octokit.rest.repos.listTags(repository);

	let errorStr = "Version not found.";

	let maxIndexOf = (str, i) => {
		let index = str.indexOf(i);
		return (index == -1) ? Number.MAX_SAFE_INTEGER : index;
	};

	let item1 = "Version of Telegram Desktop";
	let item2 = "Installation source";
	let item3 = "Used theme";
	let item4 = "<details>";
	let body = github.context.payload.issue.body;

	console.log("Body of issue:\n" + body);
	let index1 = body.indexOf(item1);
	let index2 = Math.min(
		Math.min(
			maxIndexOf(body, item2),
			maxIndexOf(body, item3)),
		maxIndexOf(body, item4));

	console.log("Index 1: " + index1);
	console.log("Index 2: " + index2);

	if (index1 == -1) {
		console.log(errorStr);
		return;
	}

	let parseVersion = str => str.match(/[0-9]{1,2}\.[0-9][0-9.]{0,}/g);

	let issueVer = parseVersion(
		body.substring(
			index1 + item1.length,
			index2));

	if (issueVer == undefined) {
		console.log(errorStr);
		return;
	}
	console.log("Version from issue: " + issueVer[0]);

	let latestVer = parseVersion(tags.data[0].name);

	if (latestVer == undefined) {
		console.log(errorStr);
		return;
	}
	console.log("Version from tags: " + latestVer[0]);

	let issueNum = issueVer[0];
	let latestNum = latestVer[0];

	console.log(`Telegram for MacOS version from website: ${macosVersion}.`);

	if (compareVersions.compare(issueNum, latestNum, '<=')
		&& compareVersions.compare(issueNum, macosVersion, '<')) {
		console.log("Seems the version from this issue is fine!");
		return;
	}
	if (compareVersions.compare(issueNum, macosVersion, '>')) {
		console.log(messageCantDecide);
		return;
	}

	let params = {
		...repository,
		issue_number: github.context.issue.number
	};

	octokit.rest.issues.createComment({
		...params,
		body: messageToClose
	});

	octokit.rest.issues.addLabels({
		...params,
		labels: ['TG macOS Swift']
	});

	octokit.rest.issues.update({
		...params,
		state: 'closed'
	});

}

const parseXml = () => {
	let filename = "versions.xml";
	if (!fs.existsSync(filename)) {
		console.log("Can't find a version file of Telegram for MacOS.");
		return;
	}
	fs.readFile(filename, "utf8", (err, xml) => {
		let options = { ignoreAttributes : false };
		let versionAttribute = "@_sparkle:shortVersionString";

		const parser = new XMLParser(options);
		let jsonObj = parser.parse(xml);
		let version = jsonObj.rss.channel.item[0].enclosure[versionAttribute];
		processIssue(version);
	});
};

parseXml();
