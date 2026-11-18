import { useCallback, useEffect, useState } from 'react'
import { createLabel, listLabels } from '../api/labelsApi.js'

// The business's label catalogue for the label picker. createNewLabel adds to it in place.
export function useLabels() {
  const [labels, setLabels] = useState([])
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let isCancelled = false
    listLabels()
      .then((labelsResponse) => {
        if (!isCancelled) {
          setLabels(labelsResponse.labels)
        }
      })
      .catch((error) => {
        if (!isCancelled) {
          setErrorMessage(error.message)
        }
      })
    return () => {
      isCancelled = true
    }
  }, [])

  const createNewLabel = useCallback(async ({ name, colorHex }) => {
    const createResponse = await createLabel({ name, colorHex })
    setLabels((currentLabels) =>
      [...currentLabels, createResponse.label].sort((firstLabel, secondLabel) => firstLabel.name.localeCompare(secondLabel.name)),
    )
    return createResponse.label
  }, [])

  return { labels, errorMessage, createNewLabel }
}
