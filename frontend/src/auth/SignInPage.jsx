import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Lock, Mail } from 'lucide-react'
import { useCurrentUser } from '../hooks/useCurrentUser.jsx'
import { AuthCardSection } from '../components/sections/AuthCardSection'
import { TextInput } from '../components/ui/TextInput'
import { Button } from '../components/ui/Button'
import { findSignInFieldErrors, placeServerError } from './authenticationFormValidation.js'
import styles from './AuthenticationForm.module.css'

export function SignInPage() {
  const { currentUser, signIn } = useCurrentUser()
  const navigate = useNavigate()
  const location = useLocation()
  const [formValues, setFormValues] = useState({ email: '', password: '' })
  const [fieldErrors, setFieldErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (currentUser) {
    return <Navigate to="/agent" replace />
  }

  const updateField = (fieldName) => (event) => {
    setFormValues((currentValues) => ({ ...currentValues, [fieldName]: event.target.value }))
    setFieldErrors((currentErrors) => ({ ...currentErrors, [fieldName]: '', form: '' }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const validationErrors = findSignInFieldErrors(formValues)
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors)
      return
    }
    setIsSubmitting(true)
    try {
      await signIn({ email: formValues.email.trim(), password: formValues.password })
      navigate(location.state?.returnPath || '/agent', { replace: true })
    } catch (error) {
      setFieldErrors(placeServerError(error.message))
      setIsSubmitting(false)
    }
  }

  return (
    <AuthCardSection
      title="Welcome back"
      description="Sign in to answer your customers."
      footer={
        <>
          New to Zenvyro? <Link to="/sign-up">Create an account</Link>
        </>
      }
    >
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <TextInput
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          leadingIcon={<Mail size={16} />}
          value={formValues.email}
          onChange={updateField('email')}
          errorMessage={fieldErrors.email}
          autoFocus
        />
        <TextInput
          label="Password"
          type="password"
          autoComplete="current-password"
          placeholder="Your password"
          leadingIcon={<Lock size={16} />}
          value={formValues.password}
          onChange={updateField('password')}
          errorMessage={fieldErrors.password}
        />
        {fieldErrors.form && (
          <p className={styles.formError} role="alert">
            {fieldErrors.form}
          </p>
        )}
        <Button type="submit" size="large" isFullWidth isLoading={isSubmitting}>
          Sign in
        </Button>
      </form>
    </AuthCardSection>
  )
}
