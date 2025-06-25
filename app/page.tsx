"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import GoogleLogin from "../components/GoogleLogin";
import {
  Calendar,
  Clock,
  Users,
  AlertTriangle,
  Plus,
  Phone,
  User,
  CalendarDays,
  Trash2,
  CalendarIcon,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import Image from "next/image"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format } from "date-fns"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"

// Firestore imports
import { db } from "../lib/firebase"
import {
  collection,
  addDoc,
  deleteDoc,
  updateDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
} from "firebase/firestore"

interface Member {
  id: string
  name: string
  mobile: string
  joinDate: string
  membershipType: string
  expiryDate: string
  status: "active" | "expired" | "expiring"
  price: number
}

export default function GymManagement() {
  const [currentTime, setCurrentTime] = useState(new Date())
  const [members, setMembers] = useState<Member[]>([])
  const [filteredMembers, setFilteredMembers] = useState<Member[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [newMember, setNewMember] = useState({
    name: "",
    mobile: "",
    membershipType: "1",
    joinDate: new Date().toISOString().split("T")[0],
    price: 0,
  })
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date())
  const { toast } = useToast()

  const MEMBERS_PER_PAGE = 10

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Load members from Firestore and listen for changes
  useEffect(() => {
    const q = query(collection(db, "members"), orderBy("joinDate", "desc"))
    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const membersData = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Member[]
        setMembers(membersData)
      },
      (error) => {
        console.error("Error loading members from Firestore:", error)
        toast({
          title: "Error Loading Members",
          description: "There was a problem loading your member data from Firestore.",
          variant: "destructive",
        })
      }
    )
    return () => unsubscribe()
  }, [toast])

  // Filter and paginate members based on search query
  useEffect(() => {
    const filtered = members.filter(
      (member) => member.name.toLowerCase().includes(searchQuery.toLowerCase()) || member.mobile.includes(searchQuery),
    )
    setFilteredMembers(filtered)
    setCurrentPage(1)
  }, [members, searchQuery])

  const calculateExpiryDate = (joinDate: string, membershipType: string) => {
    const join = new Date(joinDate)
    const months = Number.parseInt(membershipType)
    join.setMonth(join.getMonth() + months)
    return join.toISOString().split("T")[0]
  }

  const getMemberStatus = (expiryDate: string): "active" | "expired" | "expiring" => {
    const today = new Date()
    const expiry = new Date(expiryDate)
    const daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    if (daysUntilExpiry < 0) return "expired"
    if (daysUntilExpiry <= 7) return "expiring"
    return "active"
  }

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date)
      setNewMember((prev) => ({ ...prev, joinDate: date.toISOString().split("T")[0] }))
    }
  }

  // Add member to Firestore
  const addMember = async () => {
    if (!newMember.name || !newMember.mobile || !newMember.price) {
      toast({
        title: "Error",
        description: "Please fill in all required fields including price",
        variant: "destructive",
      })
      return
    }
    const expiryDate = calculateExpiryDate(newMember.joinDate, newMember.membershipType)
    const member: Omit<Member, "id"> = {
      name: newMember.name,
      mobile: newMember.mobile,
      joinDate: newMember.joinDate,
      membershipType: newMember.membershipType,
      expiryDate,
      status: getMemberStatus(expiryDate),
      price: newMember.price,
    }
    try {
      await addDoc(collection(db, "members"), member)
      setNewMember({
        name: "",
        mobile: "",
        membershipType: "1",
        joinDate: new Date().toISOString().split("T")[0],
        price: 0,
      })
      setSelectedDate(new Date())
      toast({
        title: "Success",
        description: `${member.name} has been added successfully!`,
      })
    } catch (error) {
      console.error("Error adding member:", error)
      toast({
        title: "Error Adding Member",
        description: "There was a problem adding this member to Firestore.",
        variant: "destructive",
      })
    }
  }

  // Delete member from Firestore
  const deleteMember = async (memberId: string, memberName: string) => {
    if (window.confirm(`Are you sure you want to delete ${memberName}? This action cannot be undone.`)) {
      try {
        await deleteDoc(doc(db, "members", memberId))
        toast({
          title: "Member Deleted",
          description: `${memberName} has been removed from the system.`,
          variant: "destructive",
        })
      } catch (error) {
        console.error("Error deleting member:", error)
        toast({
          title: "Error Deleting Member",
          description: "There was a problem deleting this member from Firestore.",
          variant: "destructive",
        })
      }
    }
  }

  // Renew member in Firestore
  const renewMember = async (memberId: string, memberName: string, currentExpiryDate: string) => {
    const startDatePrompt = window.prompt(
      `Renew membership for ${memberName}\n\nEnter start date (DD/MM/YYYY):\n(Leave blank to use default logic)`,
      "",
    )
    let startDate: Date
    if (startDatePrompt && startDatePrompt.trim() !== "") {
      const dateParts = startDatePrompt.split("/")
      if (dateParts.length === 3) {
        const day = Number.parseInt(dateParts[0])
        const month = Number.parseInt(dateParts[1]) - 1
        const year = Number.parseInt(dateParts[2])
        startDate = new Date(year, month, day)
        if (isNaN(startDate.getTime())) {
          alert("Invalid date. Please enter date in DD/MM/YYYY format.")
          return
        }
      } else {
        alert("Invalid date format. Please use DD/MM/YYYY format.")
        return
      }
    } else {
      const today = new Date()
      const currentExpiry = new Date(currentExpiryDate)
      startDate = currentExpiry > today ? currentExpiry : today
    }
    const selectedPlan = window.prompt(
      `Renew membership for ${memberName}\n\nSelect duration:\n1. 1 Month\n2. 3 Months\n3. 6 Months\n4. 12 Months\n\nEnter plan number (1-4):`,
    )
    if (selectedPlan && ["1", "2", "3", "4"].includes(selectedPlan)) {
      const planValues = ["1", "3", "6", "12"]
      const planLabels = ["1 Month", "3 Months", "6 Months", "12 Months"]
      const planIndex = Number.parseInt(selectedPlan) - 1
      const selectedValue = planValues[planIndex]
      const selectedLabel = planLabels[planIndex]
      const pricePrompt = window.prompt(`Enter price for ${selectedLabel} membership:`, "")
      const price = Number.parseFloat(pricePrompt || "0")
      if (!price || price <= 0) {
        alert("Please enter a valid price.")
        return
      }
      if (
        window.confirm(
          `Confirm renewal:\n${memberName}\nDuration: ${selectedLabel}\nStart Date: ${format(startDate, "dd/MM/yyyy")}\nAmount: ₹${price}\n\nProceed with renewal?`,
        )
      ) {
        const newExpiryDate = new Date(startDate)
        newExpiryDate.setMonth(newExpiryDate.getMonth() + Number.parseInt(selectedValue))
        try {
          await updateDoc(doc(db, "members", memberId), {
            membershipType: selectedValue,
            joinDate: startDate.toISOString().split("T")[0],
            expiryDate: newExpiryDate.toISOString().split("T")[0],
            status: getMemberStatus(newExpiryDate.toISOString().split("T")[0]),
            price: price,
          })
          toast({
            title: "Membership Renewed!",
            description: `${memberName}'s membership has been renewed for ${selectedLabel} at ₹${price} starting from ${format(startDate, "dd/MM/yyyy")}.`,
          })
        } catch (error) {
          console.error("Error renewing member:", error)
          toast({
            title: "Error Renewing Member",
            description: "There was a problem renewing this member in Firestore.",
            variant: "destructive",
          })
        }
      }
    }
  }

  const getExpiringMembers = () => {
    return members.filter(
      (member) => getMemberStatus(member.expiryDate) === "expiring" || getMemberStatus(member.expiryDate) === "expired",
    )
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour12: true,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-GB", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  const getMembershipTypeLabel = (type: string) => {
    const types: { [key: string]: string } = {
      "1": "1 Month",
      "3": "3 Months",
      "6": "6 Months",
      "12": "1 Year",
    }
    return types[type] || type
  }

  const getStatusBadge = (status: "active" | "expired" | "expiring") => {
    const variants = {
      active: "default",
      expiring: "secondary",
      expired: "destructive",
    } as const
    const labels = {
      active: "Active",
      expiring: "Expiring Soon",
      expired: "Expired",
    }
    return <Badge variant={variants[status]}>{labels[status]}</Badge>
  }

  const expiringMembers = getExpiringMembers()
  const totalPages = Math.ceil(filteredMembers.length / MEMBERS_PER_PAGE)
  const paginatedMembers = filteredMembers.slice((currentPage - 1) * MEMBERS_PER_PAGE, currentPage * MEMBERS_PER_PAGE)

  const nextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1)
    }
  }
  const prevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1)
    }
  }

  // Export and import CSV remain unchanged (they only affect UI, not Firestore)
  const exportMembersToCSV = () => {
    let csv = "ID,Name,Mobile,Join Date,Membership Type,Price,Expiry Date,Status\n"
    members.forEach((member) => {
      const status = getMemberStatus(member.expiryDate)
      const joinDate = new Date(member.joinDate).toLocaleDateString("en-GB")
      const expiryDate = new Date(member.expiryDate).toLocaleDateString("en-GB")
      csv += `${member.id},${member.name},${member.mobile},${joinDate},${getMembershipTypeLabel(member.membershipType)},₹${member.price || 0},${expiryDate},${status}\n`
    })
    const blob = new Blob([csv], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.setAttribute("hidden", "")
    a.setAttribute("href", url)
    a.setAttribute("download", `meg-gym-members-${new Date().toLocaleDateString("en-GB").replace(/\//g, "-")}.csv`)
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    toast({
      title: "Export Successful",
      description: `${members.length} members exported to CSV file.`,
    })
  }

  // Import CSV: add each member to Firestore
  const importMembersFromCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string
        const lines = text.split("\n")
        if (lines.length < 2) {
          throw new Error("Invalid CSV format")
        }
        let importedCount = 0
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim()
          if (!line) continue
          const values = line.split(",")
          if (values.length < 6) continue
          const membershipTypeLabel = values[4]
          let membershipType = "1"
          if (membershipTypeLabel.includes("3 Month")) membershipType = "3"
          if (membershipTypeLabel.includes("6 Month")) membershipType = "6"
          if (membershipTypeLabel.includes("1 Year")) membershipType = "12"
          const member: Omit<Member, "id"> = {
            name: values[1],
            mobile: values[2],
            joinDate: values[3],
            membershipType: membershipType,
            price: Number.parseFloat(values[5]?.replace("₹", "") || "0") || 0,
            expiryDate: values[6],
            status: getMemberStatus(values[6]),
          }
          await addDoc(collection(db, "members"), member)
          importedCount++
        }
        if (importedCount > 0) {
          toast({
            title: "Import Successful",
            description: `${importedCount} members imported successfully.`,
          })
        } else {
          throw new Error("No valid members found in CSV")
        }
      } catch (error) {
        console.error("Error importing members:", error)
        toast({
          title: "Import Failed",
          description: "There was a problem importing members. Please check the CSV format.",
          variant: "destructive",
        })
      }
      event.target.value = ""
    }
    reader.readAsText(file)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 p-4 relative">
      {/* Profile Icon & Login/Logout Dropdown */}
      <div className="absolute top-4 right-4 z-20">
        <GoogleLogin />
      </div>
      {/* Background Logo with Opacity */}
      <div className="fixed inset-0 flex items-center justify-center z-0 opacity-5 pointer-events-none">
        <Image
          src="/images/meg-gym-logo.png"
          alt="MEG GYM Logo"
          width={600}
          height={600}
          className="max-w-full max-h-full"
        />
      </div>
      <div className="max-w-7xl mx-auto space-y-6 relative z-10">
        {/* Header with Digital Clock */}
        <Card className="bg-gradient-to-r from-gray-900/95 via-black/95 to-gray-900/95 border-2 border-yellow-400 shadow-2xl overflow-hidden backdrop-blur-sm">
          <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-gray-900/90 to-black/90 z-0"></div>
          <div className="absolute inset-0 flex items-center justify-center opacity-10 z-0">
            <Image
              src="/images/meg-gym-logo.png"
              alt="MEG GYM Logo"
              width={300}
              height={300}
              className="max-w-full max-h-full"
            />
          </div>
          <CardHeader className="text-center relative z-10">
            <CardTitle className="text-3xl font-bold flex flex-col items-center justify-center gap-3">
              <div className="flex items-center gap-3">
                <span className="text-4xl font-extrabold tracking-wider text-yellow-300 drop-shadow-lg">MEG GYM</span>
              </div>
              <div className="flex flex-col items-center mt-1">
                <span className="text-sm font-normal text-yellow-300 tracking-[0.2em] drop-shadow-md">
                  TRAIN LIKE A MONSTER
                </span>
                <span className="text-xs font-normal text-yellow-100 tracking-[0.1em] mt-1 drop-shadow-md">
                  MUSCLE ENHANCING GROUNDS
                </span>
              </div>
            </CardTitle>
            <div className="space-y-2 text-yellow-100">
              <div className="flex items-center justify-center gap-2 text-2xl font-mono drop-shadow-lg">
                <Clock className="h-6 w-6 text-yellow-300" />
                {formatTime(currentTime)}
              </div>
              <div className="flex items-center justify-center gap-2 text-lg drop-shadow-md">
                <Calendar className="h-5 w-5 text-yellow-300" />
                {formatDate(currentTime)}
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Expiration Alerts */}
        {expiringMembers.length > 0 && (
          <Alert className="border-yellow-400 bg-gray-900/90 text-yellow-100 backdrop-blur-sm">
            <AlertTriangle className="h-4 w-4 text-yellow-400" />
            <AlertDescription className="text-yellow-100">
              <strong>{expiringMembers.length} member(s)</strong> have expired or expiring memberships that need
              attention.
            </AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="add-member" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 bg-gray-900/90 border border-yellow-400/50 backdrop-blur-sm">
            <TabsTrigger
              value="add-member"
              className="flex items-center gap-2 text-yellow-100 data-[state=active]:bg-yellow-400 data-[state=active]:text-black"
            >
              <Plus className="h-4 w-4" />
              Add Member
            </TabsTrigger>
            <TabsTrigger
              value="members"
              className="flex items-center gap-2 data-[state=active]:bg-yellow-400 data-[state=active]:text-black"
            >
              <Users className="h-4 w-4" />
              All Members ({members.length})
            </TabsTrigger>
            <TabsTrigger
              value="reminders"
              className="flex items-center gap-2 data-[state=active]:bg-yellow-400 data-[state=active]:text-black"
            >
              <AlertTriangle className="h-4 w-4" />
              Reminders ({expiringMembers.length})
            </TabsTrigger>
          </TabsList>

          {/* Add Member Tab */}
          <TabsContent value="add-member">
            <Card className="bg-gray-900/90 border-yellow-400/50 text-yellow-100 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-yellow-400">
                  <Plus className="h-5 w-5" />
                  Add New Member
                </CardTitle>
                <CardDescription className="text-yellow-200/80">
                  Register a new gym member with their details and membership plan
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="flex items-center gap-2 text-yellow-200">
                      <User className="h-4 w-4" />
                      Full Name *
                    </Label>
                    <Input
                      id="name"
                      placeholder="Enter member's full name"
                      value={newMember.name}
                      onChange={(e) => setNewMember((prev) => ({ ...prev, name: e.target.value }))}
                      className="bg-gray-800/80 border-yellow-400/50 focus:border-yellow-400 text-yellow-100 placeholder:text-yellow-200/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mobile" className="flex items-center gap-2 text-yellow-200">
                      <Phone className="h-4 w-4" />
                      Mobile Number *
                    </Label>
                    <Input
                      id="mobile"
                      placeholder="Enter mobile number"
                      value={newMember.mobile}
                      onChange={(e) => setNewMember((prev) => ({ ...prev, mobile: e.target.value }))}
                      className="bg-gray-800/80 border-yellow-400/50 focus:border-yellow-400 text-yellow-100 placeholder:text-yellow-200/50"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2 text-yellow-200">
                      <CalendarDays className="h-4 w-4" />
                      Membership Duration
                    </Label>
                    <Select
                      value={newMember.membershipType}
                      onValueChange={(value) => setNewMember((prev) => ({ ...prev, membershipType: value }))}
                    >
                      <SelectTrigger className="bg-gray-800/80 border-yellow-400/50 text-yellow-100">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-900 border-yellow-400/50 text-yellow-100">
                        <SelectItem value="1">1 Month</SelectItem>
                        <SelectItem value="3">3 Months</SelectItem>
                        <SelectItem value="6">6 Months</SelectItem>
                        <SelectItem value="12">1 Year</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2 text-yellow-200">
                      <CalendarIcon className="h-4 w-4" />
                      Join Date
                    </Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-start text-left font-normal bg-gray-800/80 border-yellow-400/50 text-yellow-100 hover:bg-gray-800 hover:text-yellow-200"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 bg-gray-900 border-yellow-400/50">
                        <CalendarComponent
                          mode="single"
                          selected={selectedDate}
                          onSelect={handleDateSelect}
                          initialFocus
                          className="bg-gray-900 text-yellow-100"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="price" className="flex items-center gap-2 text-yellow-200">
                    <span>₹</span>
                    Price *
                  </Label>
                  <Input
                    id="price"
                    type="number"
                    placeholder="Enter membership price"
                    value={newMember.price || ""}
                    onChange={(e) => setNewMember((prev) => ({ ...prev, price: Number(e.target.value) || 0 }))}
                    className="bg-gray-800/80 border-yellow-400/50 focus:border-yellow-400 text-yellow-100 placeholder:text-yellow-200/50"
                  />
                </div>

                <Button onClick={addMember} className="w-full bg-yellow-400 text-black hover:bg-yellow-500">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Member
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* All Members Tab */}
          <TabsContent value="members">
            <Card className="bg-gray-900/90 border-yellow-400/50 text-yellow-100 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-yellow-400">
                    <Users className="h-5 w-5" />
                    All Members ({members.length})
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-yellow-400/50 text-yellow-300 hover:bg-yellow-400/20"
                      onClick={exportMembersToCSV}
                    >
                      Export CSV
                    </Button>
                    <label>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-yellow-400/50 text-yellow-300 hover:bg-yellow-400/20"
                        onClick={() => document.getElementById("csv-upload")?.click()}
                      >
                        Import CSV
                      </Button>
                      <input
                        id="csv-upload"
                        type="file"
                        accept=".csv"
                        className="hidden"
                        onChange={importMembersFromCSV}
                      />
                    </label>
                  </div>
                </CardTitle>
                <CardDescription className="text-yellow-200/80">
                  Complete list of gym members and their membership status
                </CardDescription>
                <div className="mt-4">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-yellow-400/50" />
                    <Input
                      placeholder="Search by name or mobile number..."
                      className="pl-8 bg-gray-800/80 border-yellow-400/50 focus:border-yellow-400 text-yellow-100 placeholder:text-yellow-200/50"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {members.length === 0 ? (
                  <div className="text-center py-8 text-yellow-200/50">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No members registered yet. Add your first member to get started!</p>
                  </div>
                ) : filteredMembers.length === 0 ? (
                  <div className="text-center py-8 text-yellow-200/50">
                    <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No members found matching your search.</p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-4">
                      {paginatedMembers.map((member) => (
                        <Card
                          key={member.id}
                          className="border-l-4 border-l-yellow-400 bg-gray-900/80 text-yellow-100 backdrop-blur-sm"
                        >
                          <CardContent className="pt-4">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <h3 className="font-semibold text-lg text-yellow-100">{member.name}</h3>
                                  {getStatusBadge(getMemberStatus(member.expiryDate))}
                                </div>
                                <p className="text-yellow-200/90 flex items-center gap-1">
                                  <Phone className="h-4 w-4" />
                                  {member.mobile}
                                </p>
                              </div>
                              <div className="flex flex-col md:flex-row items-end md:items-center gap-4">
                                <div className="text-right space-y-1">
                                  <p className="text-sm text-yellow-200/70">
                                    Plan: {getMembershipTypeLabel(member.membershipType)} - ₹{member.price}
                                  </p>
                                  <p className="text-sm text-yellow-200/70">
                                    Joined: {new Date(member.joinDate).toLocaleDateString("en-GB")}
                                  </p>
                                  <p className="text-sm font-medium text-yellow-200">
                                    Expires: {new Date(member.expiryDate).toLocaleDateString("en-GB")}
                                  </p>
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => renewMember(member.id, member.name, member.expiryDate)}
                                    className="flex items-center gap-1 border-yellow-400 text-yellow-400 hover:bg-yellow-400 hover:text-black"
                                  >
                                    <CalendarDays className="h-4 w-4" />
                                    Renew
                                  </Button>
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => deleteMember(member.id, member.name)}
                                    className="flex items-center gap-1 bg-red-900 hover:bg-red-800 text-white"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                    Delete
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between mt-6">
                        <div className="text-sm text-yellow-200/70">
                          Showing {(currentPage - 1) * MEMBERS_PER_PAGE + 1} to{" "}
                          {Math.min(currentPage * MEMBERS_PER_PAGE, filteredMembers.length)} of {filteredMembers.length}{" "}
                          members
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={prevPage}
                            disabled={currentPage === 1}
                            className="border-yellow-400/50 text-yellow-300 hover:bg-yellow-400/20 disabled:opacity-50"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <span className="text-yellow-200 px-2">
                            {currentPage} / {totalPages}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={nextPage}
                            disabled={currentPage === totalPages}
                            className="border-yellow-400/50 text-yellow-300 hover:bg-yellow-400/20 disabled:opacity-50"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Reminders Tab */}
          <TabsContent value="reminders">
            <Card className="bg-gray-900/90 border-yellow-400/50 text-yellow-100 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-yellow-400">
                  <AlertTriangle className="h-5 w-5" />
                  Membership Reminders
                </CardTitle>
                <CardDescription className="text-yellow-200/80">
                  Members with expired or expiring memberships
                </CardDescription>
              </CardHeader>
              <CardContent>
                {expiringMembers.length === 0 ? (
                  <div className="text-center py-8 text-yellow-200/50">
                    <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No membership reminders at this time. All memberships are active!</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {expiringMembers.map((member) => {
                      const status = getMemberStatus(member.expiryDate)
                      const daysUntilExpiry = Math.ceil(
                        (new Date(member.expiryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24),
                      )
                      return (
                        <Card
                          key={member.id}
                          className={`border-l-4 ${
                            status === "expired"
                              ? "border-l-red-400 bg-gray-900/80"
                              : "border-l-yellow-400 bg-gray-900/80"
                          } text-yellow-100 backdrop-blur-sm`}
                        >
                          <CardContent className="pt-4">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <h3 className="font-semibold text-lg text-yellow-100">{member.name}</h3>
                                  {getStatusBadge(status)}
                                </div>
                                <p className="text-yellow-200/90 flex items-center gap-1">
                                  <Phone className="h-4 w-4" />
                                  {member.mobile}
                                </p>
                                <p className="text-sm font-medium text-yellow-200">
                                  {status === "expired"
                                    ? `Expired ${Math.abs(daysUntilExpiry)} days ago`
                                    : `Expires in ${daysUntilExpiry} days`}
                                </p>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => renewMember(member.id, member.name, member.expiryDate)}
                                  className="bg-green-700 hover:bg-green-600 text-white flex items-center gap-1"
                                >
                                  <CalendarDays className="h-3 w-3" />
                                  Renew
                                </Button>
                                <Button
                                  size="sm"
                                  className={
                                    status === "expired"
                                      ? "bg-blue-700 hover:bg-blue-600 text-white"
                                      : "bg-yellow-400 hover:bg-yellow-500 text-black"
                                  }
                                >
                                  {status === "expired" ? "Contact" : "Contact Member"}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => deleteMember(member.id, member.name)}
                                  className="flex items-center gap-1 border-red-700 text-red-500 hover:bg-red-900/20"
                                >
                                  <Trash2 className="h-3 w-3" />
                                  Delete
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}