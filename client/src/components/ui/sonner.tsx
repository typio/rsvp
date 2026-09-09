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
      toastOptions={{
        classNames: { actionButton: 'toast-btn', cancelButton: 'toast-btn' }
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
