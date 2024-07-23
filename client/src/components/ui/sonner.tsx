import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faCircleCheck,
  faCircleExclamation,
  faWarning
} from '@fortawesome/free-solid-svg-icons'

import { useTheme } from 'next-themes'
import { Toaster as Sonner } from 'sonner'

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = 'system' } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      className="toaster group data-[description]:text-black"
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-card/80 group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg pl-4',
          description: 'text-white opacity-35',
          actionButton:
            'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
          cancelButton: 'group-[.toast]:bg-secondary group-[.toast]:text-white',
          success: 'group-[.toaster]:text-primary',
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
