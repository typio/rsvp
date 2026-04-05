import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'

const About = () => (
  <div className="flex flex-col items-center justify-center gap-12 max-w-md mx-auto">
    <div className="flex flex-col gap-6 text-center">
      <h2 className="text-2xl font-semibold text-primary">
        Find a time for everyone.
      </h2>
      <p className="text-muted-foreground leading-relaxed">
        Create a room, share the link, and watch your group's availability fill in
        live. No signups and no friction.
      </p>
    </div>

    <div className="flex flex-col gap-4 w-full">
      <div className="flex flex-row items-center gap-4 p-4 rounded-lg bg-card">
        <span className="text-2xl text-primary font-bold">1</span>
        <span>Pick your dates and times</span>
      </div>
      <div className="flex flex-row items-center gap-4 p-4 rounded-lg bg-card">
        <span className="text-2xl text-primary font-bold">2</span>
        <span>Share the link with your group</span>
      </div>
      <div className="flex flex-row items-center gap-4 p-4 rounded-lg bg-card">
        <span className="text-2xl text-primary font-bold">3</span>
        <span>See who's free in real time</span>
      </div>
    </div>

    <div className="flex flex-row gap-6 text-sm text-muted-foreground">
      <a
        href="https://github.com/typio/rsvp"
        className="hover:text-primary transition-colors"
      >
        github
      </a>
      <a
        href="https://tomon.om"
        className="hover:text-primary transition-colors"
      >
        thomas
      </a>
    </div>

    <Link to="/">
      <Button>Create a room</Button>
    </Link>
  </div>
)

export default About
