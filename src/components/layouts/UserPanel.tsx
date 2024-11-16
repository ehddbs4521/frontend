import React, { useEffect, useRef, useState } from "react";
import { FiSettings, FiX } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../AuthProvider";
import axiosInstance from "../../axiosInterceptor";
import { uploadProfileToS3 } from "../../services/s3Service";
import * as S from "./Styles/UserPanel.style";

import Character from "../../assets/characters/Login_character.png";

interface UserInfoResponse {
  id: number;
  uid: string;
  nickName: string;
  profile: string;
  isFollowing: boolean;
}

interface UserPanelProps {
  onClose: () => void;
  onLogout: () => void;
}

const UserPanel: React.FC<UserPanelProps> = ({ onClose, onLogout }) => {
  const { nickname, uid, isLoggedIn } = useAuth();
  const [profileImage, setProfileImage] = useState(Character);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [followCount, setFollowCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  const [isSearchMode, setIsSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserInfoResponse[]>([]);

  const navigate = useNavigate();

  // 프로필 이미지 및 팔로우 정보 가져오기
  useEffect(() => {
    const fetchUserInfo = async () => {
      if (!uid) return;

      try {
        // 프로필 이미지 가져오기
        const profileResponse = await axiosInstance.get("/api/v1/auth/user/search", {
          params: { keyword: uid, lastId: 0 },
        });

        if (profileResponse.data.length > 0) {
          const user = profileResponse.data[0];
          setProfileImage(user.profile || Character);
        }

        // 팔로우 및 팔로잉 수 가져오기
        const followedByResponse = await axiosInstance.get(`/api/v1/followedby/${uid}`);
        setFollowCount(followedByResponse.data.content.length);

        const followingResponse = await axiosInstance.get(`/api/v1/follow/${uid}`);
        setFollowingCount(followingResponse.data.content.length);
      } catch (error) {
        console.error("사용자 정보 불러오기 실패:", error);
      }
    };

    fetchUserInfo();
  }, [uid]);

  // 유저 검색
  const handleUserSearch = async (query: string) => {
    try {
      const response = await axiosInstance.get("/api/v1/auth/user/search", {
        params: { keyword: query, lastId: 0 },
      });

      if (response.status === 200) {
        let results = response.data;

        if (isLoggedIn && uid) {
          results = results.filter((user: UserInfoResponse) => user.uid !== uid);

          const followResponse = await axiosInstance.get(`/api/v1/follow/${uid}`);
          const followedUids = followResponse.data.content.map(
            (user: UserInfoResponse) => user.uid.trim()
          );

          results = results.map((user: UserInfoResponse) => ({
            ...user,
            isFollowing: followedUids.includes(user.uid.trim()),
          }));
        }

        setSearchResults(results);
      }
    } catch (error) {
      console.error("유저 검색 실패:", error);
    }
  };

  // 팔로우/언팔로우 토글
  const handleFollowToggle = async (userUid: string, isFollowing: boolean) => {
    try {
      if (isFollowing) {
        await axiosInstance.delete("/api/v1/follow", { data: { uid: userUid } });
      } else {
        await axiosInstance.post("/api/v1/follow", { uid: userUid });
      }

      setSearchResults((prevResults) =>
        prevResults.map((user) =>
          user.uid === userUid ? { ...user, isFollowing: !isFollowing } : user
        )
      );
    } catch (error) {
      console.error("팔로우 토글 실패:", error);
    }
  };

  useEffect(() => {
    if (searchQuery.trim()) {
      handleUserSearch(searchQuery);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  // 파일 업로드
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      alert("파일을 선택해주세요.");
      return;
    }

    try {
      const s3Key = await uploadProfileToS3(file, uid, profileImage);
      const response = await axiosInstance.put("/api/v1/auth/profile", {
        profileUrl: s3Key,
      });

      if (response.status === 204) {
        alert("프로필 이미지가 성공적으로 저장되었습니다.");
        setProfileImage(s3Key);
        localStorage.setItem("profileImage", s3Key);
      }
    } catch (error) {
      console.error("프로필 이미지 처리 실패:", error);
      alert("프로필 이미지 처리에 실패했습니다.");
    }
  };

  const handleSettingsClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <S.PopupOverlay
      onClick={(e) => {
        if (e.currentTarget === e.target) onClose();
      }}
    >
      <S.PopupContainer>
        <S.CloseButton onClick={onClose}>
          <FiX size={24} />
        </S.CloseButton>
        <S.UserProfile>
          <S.UserInfo>
            <S.UserNameAndPlaylist>
              <S.UserName>{nickname || "닉네임"}</S.UserName>
              <S.UserPlaylist
                onClick={() => {
                  navigate(`/user/${uid}/playlist`);
                  onClose();
                }}
              >
                My Playlist
              </S.UserPlaylist>
            </S.UserNameAndPlaylist>
            <S.UserStats>
              <S.FollowStat>
                <S.StatLabel>follow</S.StatLabel>
                <S.StatNumber>{followCount}</S.StatNumber>
              </S.FollowStat>
              <S.FollowStat>
                <S.StatLabel>following</S.StatLabel>
                <S.StatNumber>{followingCount}</S.StatNumber>
              </S.FollowStat>
            </S.UserStats>
          </S.UserInfo>
          <S.ProfileImageContainer>
            <S.ProfileImage
              src={profileImage && !profileImage.includes("default_profile.jpeg") ? profileImage : Character}
              alt={nickname}
            />
            <S.Settings onClick={handleSettingsClick}>
              <FiSettings size={24} />
            </S.Settings>
          </S.ProfileImageContainer>
        </S.UserProfile>
        <S.Tabs>
          <S.TabItem
            onClick={() => {
              navigate(`/user/${uid}/blog`);
              onClose();
            }}
          >
            My Blog
          </S.TabItem>
          <S.Divider />
          <S.TabItem onClick={() => setIsSearchMode(!isSearchMode)}>
            유저 찾기
          </S.TabItem>
        </S.Tabs>
        {isSearchMode && (
          <S.SearchContainer>
            <S.SearchInputWrapper>
              <S.SearchInput
                placeholder="유저 검색"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </S.SearchInputWrapper>
            <S.SearchResults>
              {searchResults.map((user) => (
                <S.SearchResultItem key={user.id}>
                  <S.UserLink to={`/user/${user.uid}/blog`} onClick={onClose}>
                    <img
                      src={user.profile || Character}
                      alt={user.nickName}
                      style={{
                        width: "30px",
                        height: "30px",
                        borderRadius: "50%",
                      }}
                    />
                    <span>{user.nickName}</span>
                  </S.UserLink>
                  <S.FollowButton
                    isFollowing={user.isFollowing}
                    onClick={() =>
                      handleFollowToggle(user.uid, user.isFollowing)
                    }
                  >
                    {user.isFollowing ? "Following" : "Follow"}
                  </S.FollowButton>
                </S.SearchResultItem>
              ))}
            </S.SearchResults>
          </S.SearchContainer>
        )}
        <S.LogoutButton onClick={onLogout}>로그아웃</S.LogoutButton>
      </S.PopupContainer>

      <input
        type="file"
        ref={fileInputRef}
        style={{ display: "none" }}
        accept="image/*"
        onChange={handleFileChange}
      />
    </S.PopupOverlay>
  );
};

export default UserPanel;