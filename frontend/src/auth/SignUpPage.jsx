import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Building2, Lock, Mail, User } from 'lucide-react'
import { useCurrentUser } from '../hooks/useCurrentUser.jsx'
import { AuthCardSection } from '../components/sections/AuthCardSection'
import { TextInput } from '../components/ui/TextInput'
import { Button } from '../components/ui/Button'
import { findSignUpFieldErrors, placeServerError } from './authenticationFormValidation.js'
import styles from './AuthenticationForm.module.css'

export function SignUpPage() {
  const { currentUser, signUp } = useCurrentUser()
  const navigate = useNavigate()
  const [formValues, setFormValues] = useState({ businessName: '', name: '', email: '', password: '' })
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
    const validationErrors = findSignUpFieldErrors(formValues)
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors)
      return
    }
    setIsSubmitting(true)
    try {
      await signUp({
        businessName: formValues.businessName.trim(),
        name: formValues.name.trim(),
        email: formValues.email.trim(),
        password: formValues.password,
      })
      navigate('/agent', { replace: true })
    } catch (error) {
      setFieldErrors(placeServerError(error.message))
      setIsSubmitting(false)
    }
  }

  return (
    <AuthCardSection
      title="Create your workspace"
      description="Set up Zenvyro for your business in a minute."
      footer={
        <>
          Already have an account? <Link to="/sign-in">Sign in</Link>
        </>
      }
    >
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <TextInput
          label="Business name"
          autoComplete="organization"
          placeholder="Acme Shoes"
          leadingIcon={<Building2 size={16} />}
          value={formValues.businessName}
          onChange={updateField('businessName')}
          errorMessage={fieldErrors.businessName}
          autoFocus
        />
        <TextInput
          label="Your name"
          autoComplete="name"
          placeholder="Jordan Lee"
          leadingIcon={<User size={16} />}
          value={formValues.name}
          onChange={updateField('name')}
          errorMessage={fieldErrors.name}
        />
        <TextInput
          label="Work email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          leadingIcon={<Mail size={16} />}
          value={formValues.email}
          onChange={updateField('email')}
          errorMessage={fieldErrors.email}
        />
        <TextInput
          label="Password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
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
          Create account
        </Button>
      </form>
    </AuthCardSection>
  )
}
