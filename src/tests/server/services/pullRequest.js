// unit test
var assert = require('assert');
var sinon = require('sinon');

// config
global.config = require('../../../config');

// services
var github = require('../../../server/services/github');

// service
var pullRequest = require('../../../server/services/pullRequest');

describe('pullRequest:byLabels', function(done) {
    it('should extract 1 for pull-request-1', function(done) {
        var labels = [{name: 'review.ninja'}, {name: 'pull-request-1'}];
        var pullRequestNumber = pullRequest.byLabels(labels);
        assert.equal(pullRequestNumber, 1);
        done();
    });
});

describe('pullRequest:badgeComment', function(done) {
    it('should set github call parameters correctly', function(done) {
        config.server.github.user = 'githubUser';
        config.server.github.pass = 'githubUserApiKey';

        var githubStub = sinon.stub(github, 'call', function(args, done) {
            assert.deepEqual(args, {
                obj: 'issues',
                fun: 'createComment',
                arg: {
                    user: 'user',
                    repo: 'repo',
                    number: 456,
                    body: '[![ReviewNinja](https://review.ninja/123/pull/456/badge)](https://review.ninja/user/repo/pull/456)'
                },
                basicAuth: {
                    user: 'githubUser',
                    pass: 'githubUserApiKey'
                }
            });
        });
        
        pullRequest.badgeComment('user', 'repo', 123, 456);
        githubStub.restore();
        done();
    });
});

describe('pullRequest:setWatched', function(done) {
    it('if settings are null do not set pull.watched', function(done) {
        var pulls = [{
            head: {ref: 'feature/one'},
            base: {ref: 'master'}
        }];
        pullRequest.setWatched(pulls, null);
        assert.equal(pulls[0].hasOwnProperty('watched'), false);
        done();
    });

    it('if settings are not null, add watched property (watched by default)', function(done) {
        var settings = {
            watched: []
        };
        var pulls = [{
            head: {ref: 'feature'},
            base: {ref: 'master'}
        }];
        pullRequest.setWatched(pulls, settings);
        assert.equal(pulls[0].watched, true);
        done();
    });
});

describe('pullRequest:isWatched', function(done) {
    it('return true for feature/one if one is watching feature/*', function(done) {
        var settings = {
            watched: ['feature/*']
        };
        var pull = {
            head: {ref: 'feature/one'},
            base: {ref: 'master'}
        };
        assert.equal(pullRequest.isWatched(pull, settings), true);
        done();
    });

    it('return false if one watches feature/*-*-* and feature/one is trying to match', function(done) {
        var settings = {
            watched: ['feature/*.*.*']
        };
        var pull = {
            head: {ref: 'feature/one'},
            base: {ref: 'master'}
        };
        assert.equal(pullRequest.isWatched(pull, settings), false);
        done();
    });

    it('return false if one does not watch any pattern', function(done) {
        var settings = {
            watched: ['abcd']
        };
        var pull = {
            head: {ref: 'feature/one'},
            base: {ref: 'master'}
        };
        assert.equal(pullRequest.isWatched(pull, settings), false);
        done();
    });
});
