import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faCircleCheck,
  faCircleExclamation,
  faWarning
} from '@fortawesome/free-solid-svg-icons'

import { Toaster as Sonner } from 'sonner'

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="bg-card"
      toastOptions={{
        classNames: {
          toast:
            'toast bg-card/80 text-foreground border-border shadow-lg pl-4',
          description: 'text-white opacity-35',
          actionButton:
            'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
          cancelButton: 'group-[.toast]:bg-secondary group-[.toast]:text-white',
          success: 'text-primary',
          error: ''
        }
      }}
      icons={{
        error: (
          <FontAwesomeIcon
            className="w-4 h-4 text-destructive"
            icon={faCircleExclamation}
          />
        ),
        warning: (
          <FontAwesomeIcon className="w-4 h-4 text-primary" icon={faWarning} />
        ),

        success: (
          <FontAwesomeIcon
            className="w-4 h-4 text-primary"
            icon={faCircleCheck}
          />
        )
      }}
      {...props}
    />
  )
}

export { Toaster }
