
var async = require('async');
var express = require('express');

var logger = require('../log');

var github = require('../services/github');

//////////////////////////////////////////////////////////////////////////////////////////////
// Tool controller
//////////////////////////////////////////////////////////////////////////////////////////////

var router = express.Router();

router.all('/vote/:uuid/:comm', function(req, res) {

	// Load models
	var Tool = require('mongoose').model('Tool');
	var Repo = require('mongoose').model('Repo');
	var Vote = require('mongoose').model('Vote');

	// Tool/Voter bot id
	var uuid = req.params.uuid;

	// Commit id for repo
	var comm = req.params.comm;

	// Vote string
	var vote = req.body;


	if (!vote) {
		return res.send(400, 'Bad request, no data sent');
	}

	// Find tool
	Tool.findById(uuid, function (err, tool) {

		if (err) {
			console.log(err);
			logger.log('Mongoose[Tool] err', ['tool', 'mongoose', '500']);
			return res.send(500);
		}

		if(!tool) {
			console.log('ERROR: Tool not found. Does the tool id exist?');
			logger.log('Tool not found', ['tool', '404']);
			return res.send(404, 'Tool not found');
		}

		// See if there is already a vote on the commit
		Vote.findOne({repo: tool.repo, comm: comm, user: 'tool', name: tool.name}, function(err, previousVote) {

			if (err) {
				console.log(err);
				logger.log('Mongoose[Vote] err', ['tool', 'mongoose', '500']);
				return res.send(500);
			}

			if(previousVote) {
				console.log('ERROR: Already voted.');
				logger.log('Previously voted', ['tool', 'mongoose', '500']);
				return res.send(403);
			}

			// Find repo
			Repo.findOne({'uuid': tool.repo}, function(err, repo) {

				if (err || !repo) {
					console.log(err);
					return res.send(404, 'Repo not found');
				}

				// Get repo data
				github.call({obj: 'repos', fun: 'one', arg: {id: repo.uuid}, token: repo.token}, function(err, grepo) {

					var repoUser = grepo.owner.login;
					var repoName = grepo.name;

					var arg = {user: repoUser, repo: repoName, sha: comm};
					console.log('Calling GitHub api...');
					console.log(arg);

					// Find commit for repo
					github.call({obj: 'repos', fun: 'getCommit', arg: arg, token: repo.token}, function(err, comm) {

						if(err) {
							console.log('Error calling GitHub API');
							console.log(err);
							return res.send(err.code, err.message.message);
						}

						var queue = [];

						if(vote.comments) {
							vote.comments.forEach(function(c) {
								queue.push(function(done) {
									github.call({obj: 'repos', fun: 'createCommitComment', arg: {
										user: repoUser,
										repo: repoName,
										sha: comm.sha,
										commit_id: comm.sha,
										body: c.body,
										path: c.path,
										line: c.line
									}, token: repo.token}, done);
								});
							});
						}

						if(vote.vote && vote.vote.label) {

							queue.push(function(done) {
								github.call({obj: 'repos', fun: 'createCommitComment', arg: {
									user: repoUser,
									repo: repoName,
									sha: comm.sha,
									commit_id: comm.sha,
									body: vote.vote.label + '\n\n' + 'On behalf of ' + tool.name
								}, token: repo.token}, done);
							});
							queue.push(function(done) {
								Vote.update({repo: repo.uuid, comm: comm.sha, user: 'tool', name: tool.name}, {vote: vote.vote}, {upsert: true}, function(err, vote) {
									if(!err) {
										require('../bus').emit('vote:add', {
											uuid: grepo.id,
											user: repoUser,
											repo: repoName,
											comm: comm.sha,
											token: repo.token
										});
									}
									else {
										console.log(err);
									}
									done();
								});
							});
						}

						async.parallel(queue, function() {
							res.send(201);
						});
					
					});

				});

			});
		});
	});
});

module.exports = router;