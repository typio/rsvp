import { addDays, differenceInDays } from 'date-fns'

const Schedule = ({ dateRange, daysEnabled }) => {
  const days = Array.from({
    length:
      differenceInDays(
        dateRange?.to ?? dateRange?.from,
        dateRange?.from ?? dateRange?.to
      ) + 1
  }).map((_, n) => addDays(dateRange.from, n))

  console.log(days)

  return (
    <div>
      schedule<div>{daysEnabled}</div>
      <div className="flex flex-row">
        {days.map((day, i) => (
          <div key={`day-column-${i}`} className="flex flex-grow">
            <div className="flex flex-col flex-grow">
              <div className="flex flex-grow justify-center">
                {day.toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric'
                })}
              </div>
              {Array.from({ length: 24 }).map((_, j) => (
                <div className=" flex flex-grow justify-center bg-secondary text-secondary-foreground">
                  {j}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default Schedule
