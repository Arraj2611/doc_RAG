import { useMutation, useQuery, useQueryClient, QueryClient, UseQueryResult } from '@tanstack/react-query';
import { UserType, LoginCredentials, RegistrationData } from '@/types';
import { authApi, setFastApiToken, clearFastApiToken } from '../lib/api-client';
import { useNavigate } from 'react-router-dom';
import { useToast } from './use-toast';
import axios from 'axios';

// Define the QueryFunction type explicitly for clarity
type FetchUserQueryFn = () => Promise<UserType | null>;

type AuthResponse = UserType & { accessToken?: string }; // Expect token in response

const fetchCurrentUser: FetchUserQueryFn = async () => {
  try {
    const user = await authApi.getCurrentUser();
    return user;
  } catch (error: unknown) {
    if (!(axios.isAxiosError(error) && error.response?.status === 401)) {
      console.error("Error fetching current user:", error);
      throw error; 
    } else {
      // console.log("Fetch current user: Not authenticated (401).");
    }
    // Clear token if user fetch fails (e.g., session expired on backend)
    clearFastApiToken();
    return null; 
  }
};

export const useAuth = () => {
  const queryClient: QueryClient = useQueryClient();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Query for current user
  const { 
      data: user,
      isLoading: isLoadingUser,
      error: userError,
      refetch: refetchUser 
    }: UseQueryResult<UserType | null, Error> = useQuery({
    queryKey: ['currentUser'],
    queryFn: fetchCurrentUser,
    staleTime: 5 * 60 * 1000, 
    gcTime: 15 * 60 * 1000, 
    retry: false, 
    refetchOnWindowFocus: true,
  });

  // Login mutation
  const loginMutation = useMutation<AuthResponse, Error, LoginCredentials>({
    mutationFn: authApi.login,
    onSuccess: (data) => { // Data now includes accessToken
      const { accessToken, ...loggedInUser } = data;
      queryClient.setQueryData<UserType | null>(['currentUser'], loggedInUser);
      if (accessToken) {
        setFastApiToken(accessToken); // Store the token
        toast({ title: 'Login Successful', description: `Welcome back, ${loggedInUser.username}!` });
        navigate('/');
      } else {
        // Handle case where token is missing (shouldn't happen with backend changes)
        clearFastApiToken();
        toast({ title: 'Login Error', description: 'Authentication token missing.', variant: 'destructive' });
      }
    },
    onError: (error) => {
      clearFastApiToken(); // Clear token on login error
      const message = (error as any).response?.data?.message || error.message || 'Incorrect username or password.';
      toast({ title: 'Login Failed', description: message, variant: 'destructive' });
    },
  });

  // Registration mutation
  const registerMutation = useMutation<AuthResponse, Error, RegistrationData>({
    mutationFn: authApi.register,
    onSuccess: (data) => { // Data now includes accessToken
      const { accessToken, ...registeredUser } = data;
      queryClient.setQueryData<UserType | null>(['currentUser'], registeredUser);
      if (accessToken) {
        setFastApiToken(accessToken); // Store the token
        toast({ title: 'Registration Successful', description: `Welcome, ${registeredUser.username}!` });
        navigate('/');
      } else {
        // Handle case where token is missing
        clearFastApiToken();
        toast({ title: 'Registration Error', description: 'Authentication token missing.', variant: 'destructive' });
      }
    },
    onError: (error) => {
      clearFastApiToken(); // Clear token on registration error
      const message = (error as any).response?.data?.message || error.message || 'Could not create account.';
      toast({ title: 'Registration Failed', description: message, variant: 'destructive' });
    },
  });

  // Logout mutation
  const logoutMutation = useMutation<{ message: string }, Error, void>({
    mutationFn: authApi.logout,
    onSuccess: (data) => {
      queryClient.setQueryData<UserType | null>(['currentUser'], null);
      queryClient.removeQueries({ queryKey: ['currentUser'], exact: true });
      clearFastApiToken(); // Clear token on logout
      toast({ title: 'Logged Out', description: data.message });
      navigate('/auth');
    },
    onError: (error) => {
      const message = (error as any).response?.data?.message || error.message || 'Could not log out properly.';
      toast({ title: 'Logout Error', description: message, variant: 'destructive' });
      // Still clear user data and token even if backend logout failed
      queryClient.setQueryData<UserType | null>(['currentUser'], null);
      queryClient.removeQueries({ queryKey: ['currentUser'], exact: true });
      clearFastApiToken();
      navigate('/auth'); 
    },
  });

  return {
    user,
    isLoadingUser,
    userError,
    login: loginMutation.mutate,
    isLoggingIn: loginMutation.isPending,
    register: registerMutation.mutate,
    isRegistering: registerMutation.isPending,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
    refetchUser,
  };
};