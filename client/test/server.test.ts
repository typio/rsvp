// needs RSVP_TEST_SERVER (see README)
import { describe, expect, test } from 'bun:test'

const API = process.env.RSVP_TEST_SERVER
const WS = API?.replace(/^http/, 'ws')
const only = API ? describe : describe.skip

const auth = async () => {
  const r = await fetch(`${API}/api/auth`, { method: 'POST' })
  return r.headers.get('set-cookie')!.split(';')[0]
}
const day = (n: number) => new Date(Date.now() + n * 864e5).toDateString()
const connect = (uid: string, cookie: string) =>
  new Promise<WebSocket>((res, rej) => {
    const ws = new WebSocket(`${WS}/api/ws/${uid}`, { headers: { Cookie: cookie } } as any)
    ws.onopen = () => res(ws)
    ws.onerror = e => rej(e)
  })
const next = (ws: WebSocket, type: string, ms = 3000) =>
  new Promise<any>((res, rej) => {
    const t = setTimeout(() => rej(new Error(`timeout waiting ${type}`)), ms)
    const h = (e: MessageEvent) => {
      if (typeof e.data !== 'string' || e.data === 'ping' || e.data === 'pong') return
      const m = JSON.parse(e.data)
      if (m.messageType === type || m.messageType === 'roomFull') {
        clearTimeout(t)
        ws.removeEventListener('message', h)
        res(m)
      }
    }
    ws.addEventListener('message', h)
  })
const edit = (ws: WebSocket, name: string, sched: boolean[][]) =>
  ws.send(JSON.stringify({ message_type: 'editSchedule', payload: { user_name: name, user_schedule: sched } }))
const create = (cookie: string, body: object) =>
  fetch(`${API}/api/rooms`, {
    method: 'POST',
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event_name: 't',
      schedule_type: 0,
      dates: [day(1), day(2)],
      time_range: { from_hour: 9, to_hour: 11 },
      slot_length: 60,
      schedule: [[false, true], [true, false]],
      timezone: 'UTC',
      ...body
    })
  })

only('server', () => {
  test('create validates the grid against the time range', async () => {
    const c = await auth()
    expect((await create(c, {})).status).toBe(200)
    expect((await create(c, { schedule: [[false]] })).status).toBe(400)
    expect((await create(c, { slot_length: 45 })).status).toBe(400)
    expect((await create(c, { dates: [day(-3)] , schedule: [[false, false]] })).status).toBe(400)
  })

  test('each participant receives their own view of an edit', async () => {
    const a = await auth()
    const room = await (await create(a, {})).json()
    const b = await auth()
    const wa = await connect(room.room_uid, a)
    const wb = await connect(room.room_uid, b)
    const [ma, mb] = await Promise.all([
      next(wa, 'editSchedule'),
      next(wb, 'editSchedule'),
      (edit(wb, 'Bee', [[true, false], [false, true]]), null)
    ])
    expect(ma.payload.others).toEqual(['Bee'])
    expect(ma.payload.othersSchedule).toEqual([[[0], []], [[], [0]]])
    expect(mb.payload.userName).toBe('Bee')
    expect(mb.payload.othersSchedule).toEqual([[[], [0]], [[0], []]])
    wa.close()
    wb.close()
  })

  test('the 33rd participant is refused', async () => {
    const a = await auth()
    const room = await (await create(a, {})).json()
    const socks: WebSocket[] = []
    let refusedAt = 0
    for (let i = 2; i <= 34 && !refusedAt; i++) {
      const w = await connect(room.room_uid, await auth())
      socks.push(w)
      const p = next(w, 'editSchedule')
      edit(w, `u${i}`, [[true, false], [false, false]])
      if ((await p).messageType === 'roomFull') refusedAt = i
    }
    expect(refusedAt).toBe(33)
    socks.forEach(w => w.close())
  }, 30_000)
})
