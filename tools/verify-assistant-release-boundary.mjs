// Source-only release refusal: no bundle created and no approved uploader changed.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {buildReleaseArtifacts} from './prepare-rb01-review.mjs';
import {verifyApprovedRelease,verifyReviewCandidate} from './comms-acceptance-upload.mjs';
const source=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const candidate=JSON.parse(source('deployment/modules.json'));
const keys=Object.keys(candidate);
assert.equal(keys.length,49,'Generation 2 source-only candidate has 49 modules and is not approved for release');
assert(keys.includes('worker/personal-calendar-read.mjs'),'calendar module is included but has no approved release authority');
assert(keys.includes('worker/assistant-evidence.mjs'),'assistant evidence source must be bundled');
assert(keys.includes('worker/access.mjs')&&keys.includes('worker/mail-api.mjs'));
assert.match(candidate['worker/index.mjs'],/assistant-evidence\.mjs/);
const sourceCommit='a'.repeat(40);
assert.throws(()=>buildReleaseArtifacts({
 candidate,legacyServer:source('legacy/v03/worker/index.mjs'),
 accessModule:source('worker/access.mjs'),notificationsModule:source('worker/notifications.mjs'),
 sourceCommit
}),/RB01 review package refused: candidate module graph changed/);
const candidateBytes=Buffer.from(JSON.stringify(candidate));
const digest=value=>createHash('sha256').update(value).digest('hex');
const manifest={
 schemaVersion:1,status:'REVIEW_ONLY_NOT_DEPLOYED_OR_ACCEPTED',sourceCommit,
 candidate:{sha256:digest(candidateBytes),moduleCount:keys.length,
  modulesSha256:Object.fromEntries(keys.map(k=>[k,digest(candidate[k])]))}
};
assert.throws(()=>verifyReviewCandidate({manifest,candidateBytes,expectedSha:sourceCommit}),
 /DS011 acceptance refused: module inventory differs from reviewed build/);
assert.throws(()=>verifyApprovedRelease({manifest,candidateBytes,expectedSha:sourceCommit}),
 /DS011 acceptance refused: release is outside the immutable owner-approved source SHA/);
console.log('PASS: 49-module unapproved assistant/calendar source refuses RB01 review builder and immutable protected mail uploader. No package or deployment authorized.');
