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
      theme="dark"
      className="bg-card"
      toastOptions={{
        classNames: {
          toast:
            'toast bg-card text-foreground border border-white/10 shadow-2xl shadow-black/50 pl-4',
          description: 'text-white opacity-35',
          actionButton: 'toast-btn',
          cancelButton: 'toast-btn',
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
