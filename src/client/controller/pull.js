// *****************************************************
// Pull Request Controller
//
// tmpl: pull.html
// path: /:user/:repo/pull/:number
// resolve: repo, pull 
// *****************************************************

module.controller('PullCtrl', ['$scope', '$stateParams', '$HUB', '$RPC', '$CommitCommentService', 'repo', 'pull', function($scope, $stateParams, $HUB, $RPC, $CommitCommentService, repo, pull) {

	// get the repo
	$scope.repo = repo;

	// get the pull request
	$scope.pull = pull;

	// for the diff view
	$scope.head = $scope.pull.value.head.sha;
	$scope.base = $scope.pull.value.base.sha;

	// get the commit
	$scope.comm = $HUB.call('repos', 'getCommit', {
		user: $stateParams.user,
		repo: $stateParams.repo,
		sha: $scope.pull.value.head.sha
	});

	// get the commits
	$scope.commits = $HUB.call('pullRequests', 'getCommits', {
		user: $stateParams.user,
		repo: $stateParams.repo,
		number: $stateParams.number,
	}, function() {
		$scope.commits.value.forEach(function(comm) {
			// approval
			$RPC.call('vote', 'status', {
				repo: $scope.repo.value.id,
				comm: comm.sha
			}, function(err, status) {
				comm.status = status.value;
			});
		});
	});

	// get the base commits
	$scope.baseCommits = $HUB.call('repos', 'getCommits', {
		user: $stateParams.user,
		repo: $stateParams.repo,
		sha: $scope.pull.value.base.sha,
		per_page: 15
	});

	// get the statuses
	$scope.stat = $HUB.call('statuses', 'get', {
		user: $stateParams.user,
		repo: $stateParams.repo,
		sha: $scope.pull.value.head.sha,
	});

	// get the files (for the diff)
	$scope.files = $HUB.call('pullRequests', 'getFiles', {
		user: $stateParams.user,
		repo: $stateParams.repo,
		number: $stateParams.number
	});

	// get the tree (for the file browser)
	$scope.tree = $HUB.call('gitdata', 'getTree', {
		user: $stateParams.user,
		repo: $stateParams.repo,
		sha: $scope.pull.value.head.sha
	});

	// ger your vote
	$scope.vote = $RPC.call('vote', 'get', {
		// repo uuid
		repo: $scope.repo.value.id,
		// comm uuid
		comm: $scope.pull.value.head.sha,
	});

	// get votes
	$scope.votes = $RPC.call('vote', 'all', {
		// repo uuid
		repo: $scope.repo.value.id,
		// comm uuid
		comm: $scope.pull.value.head.sha,
	});

	// get the status
	$scope.status =	$RPC.call('vote', 'status', {
		// repo uuid
		repo: $scope.repo.value.id,
		// comm uuid
		comm: $scope.pull.value.head.sha
	});

	// get comments
	$scope.comments = {
		diff: {},
		file: {}
	};

	$scope.commitComments = $HUB.call('repos', 'getCommitComments', {
		user: $stateParams.user,
		repo: $stateParams.repo,
		sha: $scope.pull.value.head.sha
	}, function(err, comments) {
		comments.value.forEach(function(comment) {

			// In the future we will have to do one of the following:
			//
			// 1) map all line comments to line numbers (preferred)
			// 2) map all line comments to patch positions
			//    - not preferred but may be necessary due to line #s being deprecated

			if(comment.position) {
				if(!$scope.comments.diff[comment.path]) {
					$scope.comments.diff[comment.path] = {};
				}
				if(!$scope.comments.diff[comment.path][comment.position]) {
					$scope.comments.diff[comment.path][comment.position] = [];
				}
				$scope.comments.diff[comment.path][comment.position].push(comment);
			}

			if(comment.line) {
				if(!$scope.comments.file[comment.path]) {
					$scope.comments.file[comment.path] = {};
				}
				if(!$scope.comments.file[comment.path][comment.line]) {
					$scope.comments.file[comment.path][comment.line] = [];
				}
				$scope.comments.file[comment.path][comment.line].push(comment);
			}
		});
	});

	// get issues
	$scope.issue = $HUB.call('issues', 'repoIssues', {
		user: $stateParams.user,
		repo: $stateParams.repo,
		state: 'open',
		labels: 'review.ninja'
	}, function() {
		$scope.issue.value.forEach(function(c) {
			$HUB.call('issues', 'getComments', {
				user: $stateParams.user,
				repo: $stateParams.repo,
				number: c.number
			}, function(err, com) {
				c.fetchedComments = com;
			});
		});
	});

	// get ninja config file
	$scope.ninja = $RPC.call('comm', 'get', {
		uuid: $scope.repo.value.id,
		user: $stateParams.user,
		repo: $stateParams.repo,
		comm: $scope.pull.value.head.sha
	}, function() {
		$scope.ninja.value.config = JSON.parse($scope.ninja.value.ninja);
	});

	//
	// Actions
	//

	$scope.castVote = function(value) {
		$scope.vote = $RPC.call('vote', 'set', {
			// repo uuid
			repo: $scope.repo.value.id,
			// comm uuid
			comm: $scope.pull.value.head.sha,
			// vote
			vote: value
		});
	};

	$scope.merge = function() {
		$HUB.call('pullRequests', 'merge', {
			user: $stateParams.user,
			repo: $stateParams.repo,
			number: $stateParams.number
		}, function(err, res) {
			if(!err && res.value.merged) {
				$scope.pull = $HUB.call('pullRequests', 'get', {
					user: $stateParams.user,
					repo: $stateParams.repo,
					number: $stateParams.number
				});
			}
		});
	};

	$scope.compComm = function(base) {
		$HUB.call('repos', 'compareCommits', {
			user: $stateParams.user,
			repo: $stateParams.repo,
			// head sha
			head: $scope.head,
			// base sha
			base: base
		}, function(err, res) {
			if(!err) {
				$scope.base = base;
				$scope.files.value = res.value.files;
			}
		});
	};

	$scope.comment = function(body, issue, path, position, line) {

		if(body) {
			$CommitCommentService.comment($stateParams.user, $stateParams.repo, $scope.pull.value.head.sha, body, path, position, line)
				.then(function(comment) {

					$scope.commitComments.value.push(comment);

					if(comment.position) {
						if(!$scope.comments.diff[comment.path]) {
							$scope.comments.diff[comment.path] = {};
						}
						if(!$scope.comments.diff[comment.path][comment.position]) {
							$scope.comments.diff[comment.path][comment.position] = [];
						}
						$scope.comments.diff[comment.path][comment.position].push(comment);
					}

					if(comment.line) {
						if(!$scope.comments.file[comment.path]) {
							$scope.comments.file[comment.path] = {};
						}
						if(!$scope.comments.file[comment.path][comment.line]) {
							$scope.comments.file[comment.path][comment.line] = [];
						}
						$scope.comments.file[comment.path][comment.line].push(comment);
					}
				});

			if(issue) {
				$CommitCommentService.issue($stateParams.user, $stateParams.repo, $scope.pull.value.head.sha, body, path, line);
			}
		}
	};

}]);