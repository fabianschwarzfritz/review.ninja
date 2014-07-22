
var async = require('async');
var express = require('express');

var logger = require('../log');

var github = require('../services/github');

//////////////////////////////////////////////////////////////////////////////////////////////
// Tool controller
//////////////////////////////////////////////////////////////////////////////////////////////

var router = express.Router();

router.all('/vote/:uuid/:comm', function(req, res) {

	logger.log('/vote/:uuid/:comm called', req);

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
		logger.log('Bad request, no data sent', request);
		return res.send(400, 'Bad request, no data sent');
	}

	// Find tool
	Tool.findById(uuid, function (err, tool) {

		if (err) {
			logger.log('Mongoose[Tool] err', ['tool', 'mongoose', '500']);
			return res.send(500);
		}

		if(!tool) {
			logger.log('Tool does not exist', ['tool', '404']);
			return res.send(404, 'Tool does not exist');
		}

		// See if there is already a vote on the commit
		var params = {repo: tool.repo, comm: comm, user: 'tool', name: tool.name};
		Vote.findOne(params, function(err, previousVote) {

			if (err) {
				logger.log('Mongoose[Vote] err', err);
				return res.send(500, 'Mongoose error finding previous vote');
			}

			if(previousVote) {
				logger.log('Previously voted', previousVote);
				return res.send(403, 'Previously voted.');
			}

			// Find repo
			var params = {'uuid': tool.repo};
			logger.log('Finding vote...', params);
			Repo.findOne(params, function(err, repo) {

				if (err || !repo) {
					logger.log('Error finding repo', err);
					return res.send(404, 'Error finding repo');
				}

				// Get repo data
				var params = {obj: 'repos', fun: 'one', arg: {id: repo.uuid}, token: repo.token};
				logger.log('Finding repo with GitHub API...', params);
				github.call({obj: 'repos', fun: 'one', arg: {id: repo.uuid}, token: repo.token}, function(err, grepo) {

					if (err) {
						logger.log('Error finding repo', err);
						return res.send(err.code, err.message.message);
					}

					var repoUser = grepo.owner.login;
					var repoName = grepo.name;

					var arg = {user: repoUser, repo: repoName, sha: comm};

					logger.log('Finding commit with GitHub API...', arg);

					// Find commit for repo
					github.call({obj: 'repos', fun: 'getCommit', arg: arg, token: repo.token}, function(err, comm) {

						if(err) {
							logger.log('Error finding commit', err);
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
							logger.log('Done with vote');
							res.send(201);
						});
					
					});

				});

			});
		});
	});
});

module.exports = router;