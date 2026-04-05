import { $ } from 'bun'

const VPS = 'th@5.78.102.95'
const REMOTE_DIR = '/var/www/cmon-rsvp'

// Build and deploy client
console.log('Building client...')
await $`cd client && bun run build`

console.log('Deploying client...')
await $`rsync -az --delete --stats client/dist/ ${VPS}:${REMOTE_DIR}/public/`

// Deploy and build server on VPS
console.log('Syncing server source...')
await $`rsync -az --delete --stats --exclude target --exclude .env server/ ${VPS}:${REMOTE_DIR}/server/`

console.log('Building server on VPS...')
await $`ssh ${VPS} "cd ${REMOTE_DIR}/server && cargo build --release"`

console.log('Installing binary and restarting...')
await $`ssh ${VPS} "sudo systemctl stop cmon-rsvp && cp ${REMOTE_DIR}/server/target/release/rsvp ${REMOTE_DIR}/rsvp && sudo systemctl start cmon-rsvp"`

console.log('Deployment complete')
