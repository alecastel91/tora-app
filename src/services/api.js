/**
 * API Service
 * Handles all communication with the backend
 */

// Use relative URL to work with proxy
const API_URL = import.meta.env.VITE_API_URL || '/api';

class ApiService {
  constructor() {
    this.token = localStorage.getItem('token');
  }

  // Set authorization header
  getHeaders() {
    const headers = {
      'Content-Type': 'application/json'
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    return headers;
  }

  // Save token
  setToken(token) {
    this.token = token;
    localStorage.setItem('token', token);
  }

  // Remove token
  removeToken() {
    this.token = null;
    localStorage.removeItem('token');
  }

  // Handle API response
  async handleResponse(response) {
    // First check if the response is ok
    if (!response.ok) {
      // Try to parse error data
      let errorData = {};
      try {
        errorData = await response.json();
      } catch (e) {
        // If parsing fails, use status text
        errorData = { error: response.statusText || 'Something went wrong' };
      }

      // Identity gate tripped: one global signal instead of per-call-site
      // handling. App.js listens and opens the verification prompt.
      if (errorData.code === 'VERIFICATION_REQUIRED' && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('tora:verification-required', { detail: errorData }));
      }

      // Create an error object that mimics axios structure
      const error = new Error(errorData.message || errorData.error || 'Request failed');
      error.response = {
        status: response.status,
        data: errorData
      };
      throw error;
    }

    // Try to parse successful response
    try {
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Failed to parse response:', error);
      throw new Error('Invalid response format from server');
    }
  }

  // AUTH ENDPOINTS
  async signup(userData) {
    const response = await fetch(`${API_URL}/auth/signup`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(userData)
    });

    const data = await this.handleResponse(response);

    // Save token if signup successful
    if (data.token) {
      this.setToken(data.token);
    }

    return data;
  }

  async login(email, password) {
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ email, password })
      });

      const responseText = await response.text();

      // Parse the response text as JSON
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse response as JSON:', parseError);
        throw new Error('Invalid JSON response from server');
      }

      // Check if response was successful
      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      // Save token if login successful
      if (data.token) {
        this.setToken(data.token);
      }

      return data;
    } catch (error) {
      console.error('API Service: Login failed', error);
      throw error;
    }
  }

  async logout() {
    // Call logout endpoint if needed
    try {
      await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        headers: this.getHeaders()
      });
    } catch (error) {
      console.error('Logout error:', error);
    }

    // Remove token regardless
    this.removeToken();
  }

  async getCurrentUser() {
    const response = await fetch(`${API_URL}/auth/me`, {
      method: 'GET',
      headers: this.getHeaders()
    });

    return this.handleResponse(response);
  }

  async changePassword(currentPassword, newPassword) {
    const response = await fetch(`${API_URL}/auth/change-password`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ currentPassword, newPassword })
    });

    return this.handleResponse(response);
  }

  async forgotPassword(email) {
    const response = await fetch(`${API_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    return this.handleResponse(response);
  }

  async resetPassword(token, newPassword) {
    const response = await fetch(`${API_URL}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, newPassword })
    });
    return this.handleResponse(response);
  }

  async updateUserPreferences(preferences) {
    const response = await fetch(`${API_URL}/auth/update-preferences`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(preferences)
    });

    return this.handleResponse(response);
  }

  // PROFILE ENDPOINTS (we'll add these to backend next)
  async searchProfiles(filters = {}) {
    const queryParams = new URLSearchParams(filters).toString();
    // Use the authenticated search endpoint that enforces location-based restrictions
    const response = await fetch(`${API_URL}/profiles/search?${queryParams}`, {
      method: 'GET',
      headers: this.getHeaders()
    });

    return this.handleResponse(response);
  }

  async uploadAvatar(profileId, blob) {
    const formData = new FormData();
    formData.append('avatar', blob, 'avatar.webp');
    const headers = {};
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
    const response = await fetch(`${API_URL}/profiles/${profileId}/avatar`, {
      method: 'POST',
      headers, // no Content-Type — the browser sets the multipart boundary
      body: formData,
    });
    return this.handleResponse(response);
  }

  async getProfile(profileId, viewerProfileId) {
    const qs = viewerProfileId ? `?viewerProfileId=${viewerProfileId}` : '';
    const response = await fetch(`${API_URL}/profiles/${profileId}${qs}`, {
      method: 'GET',
      headers: this.getHeaders()
    });

    return this.handleResponse(response);
  }

  async updateProfile(profileId, profileData) {
    const response = await fetch(`${API_URL}/profiles/${profileId}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(profileData)
    });

    return this.handleResponse(response);
  }

  async createProfile(profileData) {
    const response = await fetch(`${API_URL}/profiles`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(profileData)
    });

    return this.handleResponse(response);
  }

  async deleteProfile(profileId) {
    const response = await fetch(`${API_URL}/profiles/${profileId}`, {
      method: 'DELETE',
      headers: this.getHeaders()
    });

    return this.handleResponse(response);
  }

  async getProfileAvatar(profileId) {
    const response = await fetch(`${API_URL}/profiles/${profileId}/avatar`, {
      method: 'GET',
      headers: this.getHeaders()
    });

    return this.handleResponse(response);
  }

  async getActionSummary(profileId, { artistProfileId } = {}) {
    const url = new URL(`${API_URL}/profiles/${profileId}/action-summary`);
    if (artistProfileId) url.searchParams.set('artistProfileId', artistProfileId);
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: this.getHeaders()
    });

    return this.handleResponse(response);
  }

  // CONNECTION ENDPOINTS
  async toggleLike(fromProfileId, toProfileId) {
    const response = await fetch(`${API_URL}/connections/like/${toProfileId}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ fromProfileId })
    });

    return this.handleResponse(response);
  }

  async sendConnectionRequest(from, to, message = '') {
    const response = await fetch(`${API_URL}/connections/request`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ from, to, message })
    });

    return this.handleResponse(response);
  }

  async acceptConnectionRequest(requestId) {
    const response = await fetch(`${API_URL}/connections/accept/${requestId}`, {
      method: 'POST',
      headers: this.getHeaders()
    });

    return this.handleResponse(response);
  }

  async declineConnectionRequest(requestId) {
    const response = await fetch(`${API_URL}/connections/decline/${requestId}`, {
      method: 'POST',
      headers: this.getHeaders()
    });

    return this.handleResponse(response);
  }

  async removeConnection(fromProfileId, toProfileId) {
    const response = await fetch(`${API_URL}/connections/remove/${toProfileId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
      body: JSON.stringify({ fromProfileId })
    });

    return this.handleResponse(response);
  }

  async getLikedProfiles(profileId) {
    const response = await fetch(`${API_URL}/connections/liked/${profileId}`, {
      method: 'GET',
      headers: this.getHeaders()
    });

    return this.handleResponse(response);
  }

  async getConnectedProfiles(profileId) {
    const response = await fetch(`${API_URL}/connections/connections/${profileId}`, {
      method: 'GET',
      headers: this.getHeaders()
    });

    return this.handleResponse(response);
  }

  async getSentRequests(profileId) {
    const response = await fetch(`${API_URL}/connections/sent-requests/${profileId}`, {
      method: 'GET',
      headers: this.getHeaders()
    });

    return this.handleResponse(response);
  }

  async getReceivedRequests(profileId) {
    const response = await fetch(`${API_URL}/connections/received-requests/${profileId}`, {
      method: 'GET',
      headers: this.getHeaders()
    });

    return this.handleResponse(response);
  }

  async getLikers(profileId) {
    const response = await fetch(`${API_URL}/connections/likers/${profileId}`, {
      method: 'GET',
      headers: this.getHeaders()
    });

    return this.handleResponse(response);
  }

  // OPTIMIZED: Get all profile data in one request
  async getProfileData(profileId) {
    const response = await fetch(`${API_URL}/connections/profile-data/${profileId}`, {
      method: 'GET',
      headers: this.getHeaders()
    });

    return this.handleResponse(response);
  }

  async getNotifications(profileId) {
    const response = await fetch(`${API_URL}/connections/notifications/${profileId}`, {
      method: 'GET',
      headers: this.getHeaders()
    });

    return this.handleResponse(response);
  }

  async clearNotifications(profileId) {
    const response = await fetch(`${API_URL}/connections/notifications/${profileId}`, {
      method: 'DELETE',
      headers: this.getHeaders()
    });

    return this.handleResponse(response);
  }

  // REPRESENTATION REQUEST ENDPOINTS
  async sendRepresentationRequest(fromProfileId, toProfileId, message = '') {
    const response = await fetch(`${API_URL}/connections/representation-request`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ fromProfileId, toProfileId, message })
    });

    return this.handleResponse(response);
  }

  async acceptRepresentationRequest(requestId) {
    const response = await fetch(`${API_URL}/connections/accept-representation/${requestId}`, {
      method: 'POST',
      headers: this.getHeaders()
    });

    return this.handleResponse(response);
  }

  async declineRepresentationRequest(requestId) {
    const response = await fetch(`${API_URL}/connections/decline-representation/${requestId}`, {
      method: 'POST',
      headers: this.getHeaders()
    });

    return this.handleResponse(response);
  }

  // Cancels an accepted representation in either direction. Pass agentId
  // when called from the artist side (removing their agent) or artistId
  // when called from the agent side (removing one of their artists). The
  // backend routes to the same handler — it identifies who the caller is
  // from currentProfileId and treats the other field as the counterparty.
  async cancelRepresentation({ agentId, artistId, currentProfileId }) {
    const response = await fetch(`${API_URL}/connections/cancel-representation`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ agentId, artistId, currentProfileId })
    });
    return this.handleResponse(response);
  }

  async getConnectionRequest(requestId) {
    const response = await fetch(`${API_URL}/connections/request/${requestId}`, {
      method: 'GET',
      headers: this.getHeaders()
    });

    return this.handleResponse(response);
  }

  // MESSAGE ENDPOINTS
  async issueVerifyCode(profileId) {
    const response = await fetch(`${API_URL}/verification/issue-code`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ profileId })
    });
    return this.handleResponse(response);
  }

  async markVerificationSent(profileId) {
    const response = await fetch(`${API_URL}/verification/mark-sent`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ profileId })
    });
    return this.handleResponse(response);
  }

  async getUnreadCount(profileId) {
    const response = await fetch(`${API_URL}/messages/unread-count?profileId=${profileId}`, {
      method: 'GET',
      headers: this.getHeaders()
    });

    return this.handleResponse(response);
  }

  async getConversations(profileId) {
    const response = await fetch(`${API_URL}/messages/conversations/${profileId}`, {
      method: 'GET',
      headers: this.getHeaders()
    });

    return this.handleResponse(response);
  }

  async getMessageThread(profileId, otherProfileId, { before } = {}) {
    const qs = before ? `?before=${encodeURIComponent(before)}` : '';
    const response = await fetch(`${API_URL}/messages/thread/${profileId}/${otherProfileId}${qs}`, {
      method: 'GET',
      headers: this.getHeaders()
    });

    return this.handleResponse(response);
  }

  async sendMessage(from, to, text, connectionRequestId = null) {
    const response = await fetch(`${API_URL}/messages/send`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ from, to, text, connectionRequestId })
    });

    return this.handleResponse(response);
  }

  async sendDocumentMessage(messageData) {
    const response = await fetch(`${API_URL}/messages/send-document`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(messageData)
    });

    return this.handleResponse(response);
  }

  // Upload an ad-hoc file (PDF or image) for the chat paperclip's
  // "Other file" slot. Returns { fileUrl, storagePath, fileSize,
  // originalName, contentType } — pass fileUrl + originalName to
  // sendDocumentMessage as documentAttachment.
  async uploadChatAttachment(file, profileId) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('profileId', profileId);
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/messages/upload-chat-attachment`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    return this.handleResponse(response);
  }

  // Resolve short URLs to full URLs
  async resolveUrl(url) {
    const response = await fetch(`${API_URL}/resolve-url`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ url })
    });

    return this.handleResponse(response);
  }

  // Deals / Bookings
  async createDeal(dealData) {
    const response = await fetch(`${API_URL}/deals`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(dealData)
    });

    return this.handleResponse(response);
  }

  async getDeals(filters = {}) {
    const queryParams = new URLSearchParams(filters).toString();
    const url = queryParams ? `${API_URL}/deals?${queryParams}` : `${API_URL}/deals`;

    const response = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders()
    });

    return this.handleResponse(response);
  }

  async getDealsForTour(tourId) {
    const response = await fetch(`${API_URL}/deals?tour=${tourId}`, {
      method: 'GET',
      headers: this.getHeaders()
    });

    return this.handleResponse(response);
  }

  async getDeal(dealId, profileId) {
    const url = profileId
      ? `${API_URL}/deals/${dealId}?profileId=${profileId}`
      : `${API_URL}/deals/${dealId}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders()
    });

    return this.handleResponse(response);
  }

  async acceptDeal(dealId, profileId) {
    const response = await fetch(`${API_URL}/deals/${dealId}/accept`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify({ profileId })
    });

    return this.handleResponse(response);
  }

  async declineDeal(dealId, profileId, reason) {
    const response = await fetch(`${API_URL}/deals/${dealId}/decline`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify({ profileId, reason })
    });

    return this.handleResponse(response);
  }

  async counterDeal(dealId, counterData) {
    const response = await fetch(`${API_URL}/deals/${dealId}/counter`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(counterData)
    });

    return this.handleResponse(response);
  }

  async deleteDeal(dealId, profileId) {
    const response = await fetch(`${API_URL}/deals/${dealId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
      body: JSON.stringify({ profileId })
    });

    return this.handleResponse(response);
  }

  // Currency / Exchange Rate Endpoints
  async getCurrentRates() {
    const response = await fetch(`${API_URL}/currency/rates`, {
      method: 'GET',
      headers: this.getHeaders()
    });

    return this.handleResponse(response);
  }

  // BOOKING WORKFLOW ENDPOINTS
  async sendContract(dealId, profileId, documentData) {
    console.log('[API Service] sendContract called with:', {
      dealId,
      profileId,
      documentData
    });

    const payload = {
      profileId,
      documentId: documentData.id,
      documentUrl: documentData.url,
      documentTitle: documentData.title
    };

    console.log('[API Service] Sending payload:', payload);
    console.log('[API Service] Validation check:', {
      hasId: !!payload.documentId,
      hasUrl: !!payload.documentUrl,
      hasTitle: !!payload.documentTitle
    });

    const response = await fetch(`${API_URL}/deals/${dealId}/send-contract`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(payload)
    });

    return this.handleResponse(response);
  }

  async signContract(dealId, profileId) {
    const response = await fetch(`${API_URL}/deals/${dealId}/sign-contract`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify({ profileId })
    });

    return this.handleResponse(response);
  }

  async sendAndSignContract(dealId, profileId, documentData, signatureData) {
    const response = await fetch(`${API_URL}/deals/${dealId}/send-and-sign-contract`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify({
        profileId,
        documentId: documentData.id,
        documentUrl: documentData.url,
        documentTitle: documentData.title,
        ...signatureData,
      }),
    });
    return this.handleResponse(response);
  }

  async skipContract(dealId, profileId) {
    const response = await fetch(`${API_URL}/deals/${dealId}/skip-contract`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify({ profileId })
    });

    return this.handleResponse(response);
  }

  async withdrawContract(dealId, profileId) {
    const response = await fetch(`${API_URL}/deals/${dealId}/withdraw-contract`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify({ profileId })
    });

    return this.handleResponse(response);
  }

  async shareDocument(dealId, profileId, documentType, documentData) {
    const response = await fetch(`${API_URL}/deals/${dealId}/share-document`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify({
        profileId,
        documentType,
        documentId: documentData.id,
        documentUrl: documentData.url,
        documentTitle: documentData.title
      })
    });

    return this.handleResponse(response);
  }

  async skipDocument(dealId, profileId, documentType) {
    const response = await fetch(`${API_URL}/deals/${dealId}/skip-document`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify({ profileId, documentType }),
    });
    return this.handleResponse(response);
  }

  async resetDocument(dealId, profileId, documentType) {
    const response = await fetch(`${API_URL}/deals/${dealId}/reset-document`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify({ profileId, documentType }),
    });
    return this.handleResponse(response);
  }

  async confirmPaymentReceipt(dealId, profileId, type, index) {
    const response = await fetch(`${API_URL}/deals/${dealId}/confirm-payment-receipt`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify({ profileId, type, index }),
    });
    return this.handleResponse(response);
  }

  async updatePayment(dealId, profileId, paymentData) {
    // Multipart upload — must include a proof file (PDF or image).
    const form = new FormData();
    form.append('profileId', profileId);
    if (paymentData.depositAmount != null) form.append('depositAmount', String(paymentData.depositAmount));
    if (paymentData.fullPayment) form.append('fullPayment', 'true');
    if (paymentData.paymentMethod) form.append('paymentMethod', paymentData.paymentMethod);
    if (paymentData.paymentNotes) form.append('paymentNotes', paymentData.paymentNotes);
    if (paymentData.proofFile) form.append('proof', paymentData.proofFile);

    // FormData sets its own Content-Type; let the browser handle it.
    const headers = {};
    const token = localStorage.getItem('token');
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(`${API_URL}/deals/${dealId}/update-payment`, {
      method: 'PUT',
      headers,
      body: form,
    });

    return this.handleResponse(response);
  }

  async convertCurrency(amount, fromCurrency, toCurrency) {
    const response = await fetch(`${API_URL}/currency/convert`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ amount, fromCurrency, toCurrency })
    });

    return this.handleResponse(response);
  }

  async updateExchangeRates() {
    const response = await fetch(`${API_URL}/currency/update-rates`, {
      method: 'POST',
      headers: this.getHeaders()
    });

    return this.handleResponse(response);
  }

  // TOUR ENDPOINTS
  async createTour(tourData) {
    const response = await fetch(`${API_URL}/tours/create`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(tourData)
    });

    return this.handleResponse(response);
  }

  async getTours(filters = {}) {
    const queryParams = new URLSearchParams();
    if (filters.zone) queryParams.append('zone', filters.zone);
    if (filters.genre) queryParams.append('genre', filters.genre);
    if (filters.role) queryParams.append('role', filters.role);
    if (filters.artistId) queryParams.append('artistId', filters.artistId);

    const response = await fetch(`${API_URL}/tours?${queryParams}`, {
      method: 'GET',
      headers: this.getHeaders()
    });

    return this.handleResponse(response);
  }

  async getMyTours() {
    const response = await fetch(`${API_URL}/tours/my-tours`, {
      method: 'GET',
      headers: this.getHeaders()
    });

    return this.handleResponse(response);
  }

  async updateTour(tourId, tourData) {
    const response = await fetch(`${API_URL}/tours/${tourId}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(tourData)
    });

    return this.handleResponse(response);
  }

  // TOUR PROPOSAL ENDPOINTS
  async createTourProposal(tourId, proposalData) {
    const response = await fetch(`${API_URL}/tours/${tourId}/proposals`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(proposalData)
    });

    return this.handleResponse(response);
  }

  async getTourProposals(tourId) {
    const response = await fetch(`${API_URL}/tours/${tourId}/proposals`, {
      method: 'GET',
      headers: this.getHeaders()
    });

    return this.handleResponse(response);
  }

  async acceptTourProposal(proposalId, response) {
    const apiResponse = await fetch(`${API_URL}/tours/proposals/${proposalId}/accept`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ response })
    });

    return this.handleResponse(apiResponse);
  }

  async declineTourProposal(proposalId, response) {
    const apiResponse = await fetch(`${API_URL}/tours/proposals/${proposalId}/decline`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ response })
    });

    return this.handleResponse(apiResponse);
  }

  // Check if user is logged in
  isAuthenticated() {
    return !!this.token;
  }
}

// Export single instance
const apiService = new ApiService();
export default apiService;