import { useCallback, useState } from 'react'

export function useToggle(defaultValue = false) {
  const [value, setValue] = useState(Boolean(defaultValue))

  const toggle = useCallback(() => {
    setValue((prev) => !prev)
  }, [])

  const setOn = useCallback(() => {
    setValue(true)
  }, [])

  const setOff = useCallback(() => {
    setValue(false)
  }, [])

  return { value, toggle, setOn, setOff }
}
