import {
    CreateUserArgs,
    getEmailSchema,
    getPasswordSchema,
} from '@lightdash/common';
import {
    Box,
    Button,
    Flex,
    PasswordInput,
    Stack,
    TextInput,
} from '@mantine/core';
import { useForm, zodResolver } from '@mantine/form';
import { OwnID } from '@ownid/react';
import { FC, useRef, useState } from 'react';
import { z } from 'zod';
import PasswordTextInput from '../PasswordTextInput';

type Props = {
    isLoading: boolean;
    readOnlyEmail?: string;
    onSubmit: (data: CreateUserArgs) => void;
};

const validationSchema = z.object({
    email: getEmailSchema(),
    password: getPasswordSchema(),
});

const CreateUserForm: FC<Props> = ({ isLoading, readOnlyEmail, onSubmit }) => {
    const emailField = useRef(null);
    const [ownIdData, setOwnIdData] = useState();

    function onRegister(event: any) {
        setOwnIdData(event.data);
    }

    const form = useForm<CreateUserArgs>({
        initialValues: {
            firstName: '',
            lastName: '',
            email: readOnlyEmail || '',
            password: '',
        },
        validate: zodResolver(validationSchema),
    });

    return (
        <form
            name="register"
            onSubmit={form.onSubmit((data: CreateUserArgs) =>
                onSubmit({ ...data, ownIdData }),
            )}
        >
            <Stack spacing="md">
                <Flex direction="row" gap="xs">
                    <TextInput
                        label="First name"
                        name="firstName"
                        placeholder="Your first name"
                        disabled={isLoading}
                        required
                        {...form.getInputProps('firstName')}
                    />
                    <TextInput
                        label="Last name"
                        name="lastName"
                        placeholder="Your last name"
                        disabled={isLoading}
                        required
                        {...form.getInputProps('lastName')}
                    />
                </Flex>
                <TextInput
                    ref={emailField}
                    label="Email address"
                    name="email"
                    placeholder="Your email address"
                    required
                    {...form.getInputProps('email')}
                    disabled={isLoading || !!readOnlyEmail}
                    data-cy="email-address-input"
                />
                <Flex>
                    <Box
                        w="72px"
                        mr="10px"
                        sx={{
                            position: 'relative',
                        }}
                    >
                        <OwnID
                            type="register"
                            loginIdField={emailField}
                            onError={(error) => console.error(error)}
                            onRegister={onRegister}
                        />
                    </Box>
                    <Box
                        sx={{
                            flex: 1,
                        }}
                    >
                        <PasswordTextInput
                            passwordValue={form.values.password as string}
                        >
                            <PasswordInput
                                label="Password"
                                name="password"
                                placeholder="Your password"
                                required={!ownIdData}
                                {...form.getInputProps('password')}
                                data-cy="password-input"
                                disabled={isLoading}
                            />
                        </PasswordTextInput>
                    </Box>
                </Flex>
                <Button
                    type="submit"
                    loading={isLoading}
                    disabled={isLoading}
                    data-cy="signup-button"
                >
                    Sign up
                </Button>
            </Stack>
        </form>
    );
};

export default CreateUserForm;
