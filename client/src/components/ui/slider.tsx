import * as React from 'react'
import * as SliderPrimitive from '@radix-ui/react-slider'

import { cn } from '@/lib/utils'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faGrip } from '@fortawesome/free-solid-svg-icons'

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn(
      'relative flex w-full touch-none select-none items-center',
      className
    )}
    {...props}
  >
    <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-background">
      <SliderPrimitive.Range className="absolute h-full bg-background" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb className="flex items-center justify-center h-6 w-8 rounded border-2 border-primary bg-card transition-colors without-ring  cursor-pointer disabled:pointer-events-none disabled:opacity-50">
      <FontAwesomeIcon icon={faGrip} size="xs" className="text-primary" />
    </SliderPrimitive.Thumb>
  </SliderPrimitive.Root>
))
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }
